import math


def run_cascade(request, cheap, capable, validate, min_confidence):
    """Cheap first; escalate on low confidence or failed validation. Returns output, escalated, cost."""
    raise NotImplementedError


def cost_per_successful_task(records):
    """Total cost / number of successful tasks (math.inf if none succeeded)."""
    raise NotImplementedError
