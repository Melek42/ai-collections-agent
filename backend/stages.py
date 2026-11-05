# stage: (name, tone, instruction for the AI)
STAGES = {
    0: ("Friendly heads-up", "friendly",
        "Friendly and light. The invoice is due very soon; this is a courtesy reminder, not a complaint."),
    1: ("Gentle nudge", "polite",
        "Polite and warm. Assume this is an oversight. Ask them to arrange payment."),
    2: ("Firm reminder", "firm",
        "Direct and professional. The invoice is clearly late. Ask for a specific payment date this week."),
    3: ("Final notice", "formal",
        "Formal and serious but respectful. This is the final reminder before the owner contacts them personally. "
        "You may say that services could be paused if payment is not arranged. Never mention legal action."),
    4: ("Human escalation", "none", "The agent does not email at this stage; the owner takes over."),
}


def stage_for(days_overdue: int):
    """days_overdue is negative before the due date. Returns None if it is too early."""
    if days_overdue < -3:
        return None
    if days_overdue <= 0:
        return 0
    if days_overdue <= 7:
        return 1
    if days_overdue <= 21:
        return 2
    if days_overdue <= 45:
        return 3
    return 4