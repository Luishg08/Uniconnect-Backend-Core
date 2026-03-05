# Auth0 BFF Endpoint Documentation

## TSK-3.1 Implementation: Auth0 Authorization Code Exchange

### Endpoint Details
- **URL**: `POST /api/auth/callback`
- **Purpose**: BFF (Backend for Frontend) endpoint for Auth0 Universal Login integration
- **Security**: Handles client secret securely on the backend

### Request Format
```json
{
  "code": "authorization_code_from_auth0",
  "redirect_uri": "exp://localhost:8081/--/auth/callback"
}
```

### Response Format (FEN Standard)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Authentication successful",
  "data": {
    "access_token": "local_jwt_token_with_permissions",
    "user": {
      "id_user": 1,
      "id_role": 2,
      "full_name": "John Doe",
      "email": "john.doe@ucaldas.edu.co",
      "picture": "https://example.com/avatar.jpg"
    },
    "auth0_tokens": {
      "access_token": "auth0_access_token",
      "id_token": "auth0_id_token", 
      "refresh_token": "auth0_refresh_token",
      "expires_in": 3600
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Email domain not allowed. Only @ucaldas.edu.co emails are permitted.",
  "error": "Unauthorized"
}
```

### Flow Description
1. Frontend receives authorization code from Auth0 Universal Login
2. Frontend sends code + redirect_uri to this BFF endpoint
3. BFF exchanges code for Auth0 tokens using client secret
4. BFF retrieves user profile from Auth0
5. BFF validates email domain (@ucaldas.edu.co only)
6. BFF creates/updates user in local database
7. BFF generates local JWT with role permissions
8. BFF returns FEN-formatted response with both local and Auth0 tokens

### Environment Variables Required
```env
AUTH0_DOMAIN=dev-tuflbr5cbjtkf3zm.us.auth0.com
AUTH0_CLIENT_ID=fP8oFibh9VcVPS7Ly9HHb2vQBdFHDNO2
AUTH0_CLIENT_SECRET=eJt9IVJyzn1qGjmrfOWkc6XCARERqrIqvbMryY_SgCVOTy0gqyV-s337hlXMlhNC
```

### Next Steps (TSK-3.2)
The frontend AuthController should be updated to:
1. Call this endpoint with the authorization code
2. Handle the FEN response
3. Update the AuthStore with the received data
4. Navigate to the authenticated area of the app

### Testing
- Swagger documentation available at: `http://localhost:8007/docs`
- Endpoint accessible at: `http://localhost:8007/api/auth/callback`