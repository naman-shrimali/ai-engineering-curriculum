def validate_args(schema, args):
    """Errors (list of str) for args against the schema subset; [] when valid."""
    raise NotImplementedError


def execute_tool_call(call, tools, session):
    """Validate, then authorize from the session, then run. Always returns a string."""
    raise NotImplementedError
