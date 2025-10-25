package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// Message represents a WhatsApp message
type Message struct {
	ID        string    `json:"id"`
	Sender    string    `json:"sender"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
	ChatJID   string    `json:"chat_jid"`
	Type      string    `json:"type"`
}

// ChatInfo represents chat information
type ChatInfo struct {
	Name      string    `json:"name"`
	Timestamp time.Time `json:"timestamp"`
}

// MessageStore handles message storage
type MessageStore struct {
	db *sql.DB
}

// NewMessageStore creates a new message store
func NewMessageStore(dbPath string) (*MessageStore, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=1")
	if err != nil {
		return nil, err
	}

	// Create tables if they don't exist
	createTables := `
	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		sender TEXT NOT NULL,
		content TEXT NOT NULL,
		timestamp DATETIME NOT NULL,
		chat_jid TEXT NOT NULL,
		type TEXT NOT NULL
	);
	
	CREATE TABLE IF NOT EXISTS chats (
		jid TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		timestamp DATETIME NOT NULL
	);
	
	CREATE INDEX IF NOT EXISTS idx_messages_chat_jid ON messages(chat_jid);
	CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
	`

	if _, err := db.Exec(createTables); err != nil {
		return nil, err
	}

	return &MessageStore{db: db}, nil
}

// SaveMessage saves a message to the database
func (ms *MessageStore) SaveMessage(msg *Message) error {
	query := `
	INSERT OR REPLACE INTO messages (id, sender, content, timestamp, chat_jid, type)
	VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err := ms.db.Exec(query, msg.ID, msg.Sender, msg.Content, msg.Timestamp, msg.ChatJID, msg.Type)
	return err
}

// GetMessages retrieves messages for a specific chat
func (ms *MessageStore) GetMessages(chatJID string) ([]*Message, error) {
	// Calculate 3 weeks ago
	threeWeeksAgo := time.Now().AddDate(0, 0, -21)

	query := `
	SELECT id, sender, content, timestamp, chat_jid, type
	FROM messages
	WHERE chat_jid = ? AND timestamp >= ?
	ORDER BY timestamp ASC
	`
	rows, err := ms.db.Query(query, chatJID, threeWeeksAgo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.Sender, &msg.Content, &msg.Timestamp, &msg.ChatJID, &msg.Type)
		if err != nil {
			return nil, err
		}
		messages = append(messages, &msg)
	}

	return messages, nil
}

// SaveChat saves chat information
func (ms *MessageStore) SaveChat(jid, name string) error {
	query := `
	INSERT OR REPLACE INTO chats (jid, name, timestamp)
	VALUES (?, ?, ?)
	`
	_, err := ms.db.Exec(query, jid, name, time.Now())
	return err
}

// GetChats retrieves all chats
func (ms *MessageStore) GetChats() (map[string]time.Time, error) {
	query := `
	SELECT jid, name, timestamp
	FROM chats
	ORDER BY timestamp DESC
	`
	rows, err := ms.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chats := make(map[string]time.Time)
	for rows.Next() {
		var jid, name string
		var timestamp time.Time
		err := rows.Scan(&jid, &name, &timestamp)
		if err != nil {
			return nil, err
		}
		chats[jid] = timestamp
	}

	return chats, nil
}

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cache-Control, Pragma")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// GetChatName extracts chat name from JID
func GetChatName(client *whatsmeow.Client, messageStore *MessageStore, jid types.JID, fallbackJID string, info *types.GroupInfo, pushName string) string {
	if jid.Server == types.GroupServer {
		if info != nil {
			return info.Name
		}
		// Try to get group info
		groupInfo, err := client.GetGroupInfo(jid)
		if err == nil && groupInfo != nil {
			return groupInfo.Name
		}
		return fmt.Sprintf("Group %s", jid.User)
	} else if jid.Server == types.BroadcastServer {
		return "Broadcast"
	} else {
		if pushName != "" {
			return pushName
		}
		// Try to get contact info
		contact, err := client.Store.Contacts.GetContact(context.Background(), jid)
		if err == nil && contact.FullName != "" {
			return contact.FullName
		}
		return fmt.Sprintf("+%s", jid.User)
	}
}

var isReconnecting bool

func main() {
	// Create data directory
	dataDir := "./data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	// Initialize message store
	messageStore, err := NewMessageStore(filepath.Join(dataDir, "messages.db"))
	if err != nil {
		log.Fatalf("Failed to initialize message store: %v", err)
	}

	// Initialize WhatsApp client
	container, err := sqlstore.New(context.Background(), "sqlite3", filepath.Join(dataDir, "whatsapp.db")+"?_foreign_keys=1", nil)
	if err != nil {
		log.Fatalf("Failed to create database: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		log.Fatalf("Failed to get device: %v", err)
	}

	client := whatsmeow.NewClient(deviceStore, nil)

	// Event handler
	client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			// Process message
			msg := &Message{
				ID:        v.Info.ID,
				Sender:    v.Info.Sender.String(),
				Content:   v.Message.GetConversation(),
				Timestamp: v.Info.Timestamp,
				ChatJID:   v.Info.Chat.String(),
				Type:      "text",
			}

			// Save message
			if err := messageStore.SaveMessage(msg); err != nil {
				log.Printf("Failed to save message: %v", err)
			}

			// Save chat info
			chatName := GetChatName(client, messageStore, v.Info.Chat, v.Info.Chat.String(), nil, "")
			if err := messageStore.SaveChat(v.Info.Chat.String(), chatName); err != nil {
				log.Printf("Failed to save chat: %v", err)
			}

			log.Printf("Message from %s: %s", msg.Sender, msg.Content)

		case *events.Connected:
			log.Println("Connected to WhatsApp")

		case *events.Disconnected:
			log.Println("Disconnected from WhatsApp")
		}
	})

	// Set up HTTP handlers
	http.HandleFunc("/api/status", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var jid string
		connected := false
		if client.Store.ID != nil && client.Store.ID.User != "" {
			jid = client.Store.ID.String()
			connected = client.IsConnected()
		}
		status := map[string]interface{}{
			"connected": connected,
			"jid":       jid,
		}
		json.NewEncoder(w).Encode(status)
	}))

	http.HandleFunc("/api/chats", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		chats, err := messageStore.GetChats()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get chats: %v", err), http.StatusInternalServerError)
			return
		}

		// Convert to ChatInfo format
		chatInfos := make(map[string]ChatInfo)
		for jid, timestamp := range chats {
			parsedJID, err := types.ParseJID(jid)
			if err != nil {
				continue
			}
			name := GetChatName(client, messageStore, parsedJID, jid, nil, "")
			chatInfos[jid] = ChatInfo{
				Name:      name,
				Timestamp: timestamp,
			}
		}

		json.NewEncoder(w).Encode(chatInfos)
	}))

	http.HandleFunc("/api/messages", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		chatID := r.URL.Query().Get("chatId")
		if chatID == "" {
			http.Error(w, "chatId parameter is required", http.StatusBadRequest)
			return
		}

		messages, err := messageStore.GetMessages(chatID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get messages: %v", err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(messages)
	}))

http.HandleFunc("/api/qr", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")

		// Check if QR code file exists
		if _, err := os.Stat("qr.png"); err == nil {
			// Read the QR code file and convert to base64
			qrData, err := os.ReadFile("qr.png")
			if err != nil {
				response := map[string]interface{}{
					"error": "Failed to read QR code",
				}
				json.NewEncoder(w).Encode(response)
				return
			}

			// Convert to base64 data URL
			base64QR := "data:image/png;base64," + base64.StdEncoding.EncodeToString(qrData)

			response := map[string]interface{}{
				"qr": base64QR,
			}
			json.NewEncoder(w).Encode(response)
		} else {
			response := map[string]interface{}{
				"error": "QR code not available",
			}
			json.NewEncoder(w).Encode(response)
		}
	}))

	// Serve QR code image directly
	http.HandleFunc("/qr.png", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, "qr.png")
	}))

	// Logout/Disconnect endpoint
	http.HandleFunc("/api/logout", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		if client.IsConnected() {
			// Disconnect from WhatsApp
			client.Disconnect()

			// Clear the stored device data
			if client.Store.ID != nil {
				// Remove the device from store
				err := client.Store.Delete(context.Background())
				if err != nil {
					log.Printf("Error deleting device store: %v", err)
				}
			}

			// Remove QR code file if it exists
			os.Remove("qr.png")

			response := map[string]interface{}{
				"success": true,
				"message": "Successfully disconnected from WhatsApp. New QR code will be generated shortly.",
			}
			json.NewEncoder(w).Encode(response)
			log.Println("User logged out from WhatsApp")

			// Start reconnection process in a goroutine after a short delay
			go func() {
				time.Sleep(2 * time.Second) // Wait 2 seconds before generating new QR
				reconnectWhatsApp(client)
			}()
		} else {
			// If not connected, just generate a new QR code
			os.Remove("qr.png")
			go func() {
				time.Sleep(1 * time.Second)
				reconnectWhatsApp(client)
			}()

			response := map[string]interface{}{
				"success": true,
				"message": "Generating new QR code for connection.",
			}
			json.NewEncoder(w).Encode(response)
		}
	}))

	// Start HTTP server in a goroutine
	go func() {
		fmt.Println("Starting WhatsApp bridge server on :8081...")
		log.Fatal(http.ListenAndServe(":8081", nil))
	}()

	// Connect to WhatsApp
	if client.Store.ID == nil {
		// No ID stored, need to pair with phone
		qrChan, _ := client.GetQRChannel(context.Background())
		err = client.Connect()
		if err != nil {
			log.Printf("Failed to connect: %v", err)
			return
		}

		// Print QR code
		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					fmt.Println("\nScan this QR code with your WhatsApp app:")
					// Remove old QR code file
					os.Remove("qr.png")
					// Generate new QR code
					qrcode.WriteFile(evt.Code, qrcode.Medium, 256, "qr.png")
					fmt.Println("QR code saved as qr.png")
				} else if evt.Event == "success" {
					fmt.Println("\nSuccessfully connected!")
					break
				}
			}
		}()
	} else {
		// Already paired, just connect
		err = client.Connect()
		if err != nil {
			log.Printf("Failed to connect: %v", err)
			return
		}
	}

	// QR regeneration endpoint
	http.HandleFunc("/api/regenerate-qr", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		if !client.IsConnected() || client.Store.ID == nil {
			// Remove old QR code file
			os.Remove("qr.png")

			// Generate new QR code
			go func() {
				log.Println("Regenerating QR code...")
				qrChan, _ := client.GetQRChannel(context.Background())
				err := client.Connect()
				if err != nil {
					log.Printf("Failed to connect during QR regeneration: %v", err)
					return
				}

				for evt := range qrChan {
					if evt.Event == "code" {
						fmt.Println("\nNew QR code generated:")
						qrcode.WriteFile(evt.Code, qrcode.Medium, 256, "qr.png")
						fmt.Println("QR code saved as qr.png")
						break
					} else if evt.Event == "success" {
						fmt.Println("\nSuccessfully connected!")
						break
					}
				}
			}()

			response := map[string]interface{}{
				"success": true,
				"message": "QR code regeneration initiated",
			}
			json.NewEncoder(w).Encode(response)
		} else {
			response := map[string]interface{}{
				"success": false,
				"message": "Already connected to WhatsApp",
			}
			json.NewEncoder(w).Encode(response)
		}
	}))

	// Restart endpoint
	http.HandleFunc("/api/restart", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		response := map[string]interface{}{
			"success": true,
			"message": "Bridge restart initiated",
		}
		json.NewEncoder(w).Encode(response)

		// Restart the bridge in a goroutine
		go func() {
			log.Println("Restarting bridge...")
			// Give time for response to be sent
			time.Sleep(1 * time.Second)
			// Exit the current process - the system will restart it
			os.Exit(0)
		}()
	}))

	// Keep the main goroutine alive
	select {}
}

// Reconnect function to generate new QR code after logout
func reconnectWhatsApp(client *whatsmeow.Client) {
	if isReconnecting {
		log.Println("Reconnection already in progress, skipping...")
		return
	}

	isReconnecting = true
	log.Println("Starting reconnection process...")

	// Only generate QR code if not already connected
	if !client.IsConnected() {
		// Disconnect first to ensure clean state
		client.Disconnect()

		// Get QR channel
		qrChan, _ := client.GetQRChannel(context.Background())
		err := client.Connect()
		if err != nil {
			log.Printf("Failed to connect during reconnection: %v", err)
			isReconnecting = false
			return
		}

		// Generate QR code once
		go func() {
			defer func() { isReconnecting = false }()
			for evt := range qrChan {
				if evt.Event == "code" {
					fmt.Println("\nNew QR code generated for reconnection:")
					// Remove old QR code file
					os.Remove("qr.png")
					// Generate new QR code
					qrcode.WriteFile(evt.Code, qrcode.Medium, 256, "qr.png")
					fmt.Println("QR code saved as qr.png")
					break // Only generate one QR code
				} else if evt.Event == "success" {
					fmt.Println("\nSuccessfully reconnected!")
					break
				}
			}
		}()
	} else {
		isReconnecting = false
	}
}
