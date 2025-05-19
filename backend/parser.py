def parse_chat(text: str):
    # Dummy example: just return two fake blocks
    return [
        {
            "summary": "Discussed team formation and tasks.",
            "tasks": ["Assign roles", "Create shared drive"],
            "decisions": ["Use Notion for planning"],
            "questions": ["Who's making the pitch deck?"],
        },
        {
            "summary": "Talked about event deadlines.",
            "tasks": ["Submit abstract", "Design poster"],
            "decisions": ["Deadline: May 30"],
            "questions": [],
        }
    ]
