// method_identity.ts -- D-BP152-040/BISHOP/seg-method-identity-registry
//
// THE NAMENUMBERED METHOD IDENTITY. Founder ruling, BP152, verbatim (RULINGS_BP152.md
// FD-BP152-20): "I want to use it to stack methods in whatever order I want - I don't need the
// lego shapes, I just want them NameNumbered (so that we can have iterations galore) as methods
// so that I can mix and match as I please." And, on the mechanism itself: "every method carries
// a NAME and a NUMBER, so iterations proliferate without collision (`Survey:3`,
// `ClassifyCascade:7`) -- and the operator stacks them in whatever order he chooses ... The
// numbering is what makes 'iterations galore' possible -- the same versioning as `19:1`/`19:2`,
// at method scale."
//
// `Name:Number` IS the canonical identity -- the only string form used anywhere. Same name,
// different number is a different iteration, never a replacement (Rule 66: version, never
// overwrite).
//
// THIS FILE HOLDS ONLY THE TYPE AND ITS PARSE/FORMAT HELPERS. No registry, no storage, no
// execution -- see method_registry.ts for the map that holds registered identities.
function assertValidName(name) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new Error(`method_identity: malformed name ${JSON.stringify(name)} -- must be a non-empty string`);
    }
    if (name.includes(':')) {
        throw new Error(`method_identity: malformed name ${JSON.stringify(name)} -- a name must not contain ":"`);
    }
    if (name.trim() !== name) {
        throw new Error(`method_identity: malformed name ${JSON.stringify(name)} -- no leading/trailing whitespace`);
    }
}
function assertValidNumber(number) {
    if (typeof number !== 'number' || !Number.isInteger(number) || !Number.isSafeInteger(number) || number < 1) {
        throw new Error(`method_identity: malformed number ${JSON.stringify(number)} -- must be a positive integer (1-based iteration)`);
    }
}
/** Formats a validated `name`/`number` pair into the canonical `Name:Number` string. Throws
 *  rather than coercing on an invalid name or number -- per this ticket's instruction, "reject a
 *  malformed id rather than coercing it." */
export function formatMethodId(name, number) {
    assertValidName(name);
    assertValidNumber(number);
    return `${name}:${number}`;
}
/** Parses a canonical `Name:Number` string back into a MethodIdentity. Rejects, rather than
 *  coerces, anything that is not EXACTLY one `:` separating a valid name from a valid 1-based
 *  integer: no colon, more than one colon, an empty name, a name with surrounding whitespace, a
 *  non-integer number, a zero/negative number, a number with leading zeros (e.g. "01"), or a
 *  number with a leading `+`. */
export function parseMethodId(id) {
    if (typeof id !== 'string') {
        throw new Error(`method_identity: malformed id ${JSON.stringify(id)} -- must be a string`);
    }
    const firstColon = id.indexOf(':');
    const lastColon = id.lastIndexOf(':');
    if (firstColon === -1) {
        throw new Error(`method_identity: malformed id "${id}" -- expected exactly one ":" separating name and number, found none`);
    }
    if (firstColon !== lastColon) {
        throw new Error(`method_identity: malformed id "${id}" -- expected exactly one ":" separating name and number, found more than one`);
    }
    const namePart = id.slice(0, firstColon);
    const numberPart = id.slice(firstColon + 1);
    assertValidName(namePart);
    if (!/^[1-9]\d*$/.test(numberPart)) {
        throw new Error(`method_identity: malformed id "${id}" -- the number half must be a positive integer with no leading zeros, no sign, and no fractional part`);
    }
    const number = Number(numberPart);
    assertValidNumber(number);
    return { name: namePart, number, id };
}
/** Builds a MethodIdentity from a `name`/`number` pair, validating both and composing the
 *  canonical `id` from them (round-trips through formatMethodId()/parseMethodId() rather than
 *  assembling the string a second way). */
export function makeMethodIdentity(name, number) {
    return parseMethodId(formatMethodId(name, number));
}
