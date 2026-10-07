TYPES = {
    'string': lambda v: isinstance(v, str),
    'integer': lambda v: isinstance(v, int) and not isinstance(v, bool),
    'number': lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    'boolean': lambda v: isinstance(v, bool),
    'array': lambda v: isinstance(v, list),
    'object': lambda v: isinstance(v, dict),
}


def _check(name, spec, value, errors):
    t = spec.get('type')
    if t and not TYPES[t](value):
        errors.append(f"field '{name}' must be {t}, got {type(value).__name__}")
        return
    if 'enum' in spec and value not in spec['enum']:
        errors.append(f"field '{name}' must be one of {spec['enum']}, got {value!r}")
    if t == 'array' and 'items' in spec:
        for i, item in enumerate(value):
            _check(f'{name}[{i}]', spec['items'], item, errors)


def validate_args(schema, args):
    if not isinstance(args, dict):
        return ['arguments must be an object']
    errors = []
    props = schema.get('properties', {})
    for name in schema.get('required', []):
        if name not in args:
            errors.append(f"missing required field '{name}'")
    for name, value in args.items():
        if name not in props:
            if schema.get('additionalProperties') is False:
                errors.append(f"unexpected field '{name}'")
            continue
        _check(name, props[name], value, errors)
    return errors


def execute_tool_call(call, tools, session):
    tool = tools.get(call.get('name'))
    if tool is None:
        return f"error: unknown tool '{call.get('name')}'"
    args = call.get('input', {})
    errors = validate_args(tool['schema'], args)
    if errors:
        return 'error: invalid arguments: ' + '; '.join(errors)
    if tool['permission'] not in session.get('permissions', set()):
        return f"error: not authorized: this session lacks '{tool['permission']}'"
    try:
        return str(tool['fn'](**args))
    except Exception as e:
        return f'error: {e}'
