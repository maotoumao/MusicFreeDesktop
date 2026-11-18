export function generateTokenAuthHeader(token) {
    return `${token.token_type} ${token.access_token}`;
}
