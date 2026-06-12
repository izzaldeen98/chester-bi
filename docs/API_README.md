# API

**Version:** `1.0.0`

API for the application

## Agent Usage Rules

- Use `openapi.json` as the source of truth.
- Use this Markdown file for readable endpoint behavior.
- Prefer public UUID fields over internal database IDs.
- For file upload endpoints, use `multipart/form-data`.
- Never call delete endpoints unless explicitly instructed.
- Validate required fields before calling an endpoint.

## Endpoints

### `POST /api/v1/auth/login`

**Summary:** Login For Access Token

**Operation ID:** `login_for_access_token_api_v1_auth_login_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `application/x-www-form-urlencoded`
- Schema: `Body_login_for_access_token_api_v1_auth_login_post`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `POST /api/v1/auth/register`

**Summary:** Register User

**Operation ID:** `register_user_api_v1_auth_register_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `application/json`
- Schema: `OwnerCreate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `201` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `PUT /api/v1/auth/set-password`

**Summary:** Set Password

**Operation ID:** `set_password_api_v1_auth_set_password_put`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `username` | `query` | `string` | Yes |  |
| `account_name` | `query` | `string` | Yes |  |
| `password` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `POST /api/v1/users/create`

**Summary:** Register User

**Operation ID:** `register_user_api_v1_users_create_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `application/json`
- Schema: `UserCreate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `201` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/users/list`

**Summary:** Get Users

**Operation ID:** `get_users_api_v1_users_list_get`

#### Parameters

No parameters.

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `array[UserPublicResponse]` |

---

### `PUT /api/v1/users/update`

**Summary:** Update User

**Operation ID:** `update_user_api_v1_users_update_put`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user_id` | `query` | `string` | Yes |  |

#### Request Body

- Content-Type: `application/json`
- Schema: `UserUpdate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `204` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `DELETE /api/v1/users/delete`

**Summary:** Delete User

**Operation ID:** `delete_user_api_v1_users_delete_delete`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `204` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `POST /api/v1/dashboards/create`

**Summary:** Create Dashboard

**Operation ID:** `create_dashboard_api_v1_dashboards_create_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `application/json`
- Schema: `DashboardCreate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `201` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/dashboards/get`

**Summary:** Get Dashboard

**Operation ID:** `get_dashboard_api_v1_dashboards_get_get`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `dashboard_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `DashboardPublicResponse` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/dashboards/list`

**Summary:** List Dashboards

**Operation ID:** `list_dashboards_api_v1_dashboards_list_get`

#### Parameters

No parameters.

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `array[DashboardPublicResponse]` |

---

### `GET /api/v1/dashboards/load/{public_key}`

**Summary:** Load Dashboard

**Operation ID:** `load_dashboard_api_v1_dashboards_load__public_key__get`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `public_key` | `path` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `string` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `DELETE /api/v1/dashboards/delete`

**Summary:** Delete Dashboard

**Operation ID:** `delete_dashboard_api_v1_dashboards_delete_delete`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `dashboard_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `204` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `PUT /api/v1/dashboards/update`

**Summary:** Update Dashboard

**Operation ID:** `update_dashboard_api_v1_dashboards_update_put`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `dashboard_id` | `query` | `string` | Yes |  |

#### Request Body

- Content-Type: `application/json`
- Schema: `DashboardUpdate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `204` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `POST /api/v1/connections/create`

**Summary:** Create Connection

**Operation ID:** `create_connection_api_v1_connections_create_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `application/json`
- Schema: `ConnectionCreate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `201` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/connections/list`

**Summary:** List Connections

**Operation ID:** `list_connections_api_v1_connections_list_get`

#### Parameters

No parameters.

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `array[ConnectionPublicResponse]` |

---

### `PUT /api/v1/connections/update`

**Summary:** Update Connection

**Operation ID:** `update_connection_api_v1_connections_update_put`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `connection_id` | `query` | `string` | Yes |  |

#### Request Body

- Content-Type: `application/json`
- Schema: `ConnectionUpdate`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `ConnectionPublicResponse` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `DELETE /api/v1/connections/delete`

**Summary:** Delete Connection

**Operation ID:** `delete_connection_api_v1_connections_delete_delete`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `connection_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `204` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/connections/test-connection`

**Summary:** Test Connection

**Operation ID:** `test_connection_api_v1_connections_test_connection_get`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `connection_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `POST /api/v1/packages/create`

**Summary:** Create Package

**Operation ID:** `create_package_api_v1_packages_create_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `application/x-www-form-urlencoded`
- Schema: `Body_create_package_api_v1_packages_create_post`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `201` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/packages/list`

**Summary:** List Packages

**Operation ID:** `list_packages_api_v1_packages_list_get`

#### Parameters

No parameters.

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `array[PackageResponse]` |

---

### `GET /api/v1/packages/get`

**Summary:** Get Package

**Operation ID:** `get_package_api_v1_packages_get_get`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `package_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `PackageResponse` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `GET /api/v1/packages/list-files`

**Summary:** List Files

**Operation ID:** `list_files_api_v1_packages_list_files_get`

#### Parameters

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `package_id` | `query` | `string` | Yes |  |

#### Request Body

No request body.

#### Responses

| Status | Description | Schema |
|---|---|---|
| `200` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

### `POST /api/v1/semantic-models/add`

**Summary:** Add Semantic Model

**Operation ID:** `add_semantic_model_api_v1_semantic_models_add_post`

#### Parameters

No parameters.

#### Request Body

- Content-Type: `multipart/form-data`
- Schema: `Body_add_semantic_model_api_v1_semantic_models_add_post`

#### Responses

| Status | Description | Schema |
|---|---|---|
| `201` | Successful Response | `N/A` |
| `422` | Validation Error | `HTTPValidationError` |

---

## Schemas

### `Body_add_semantic_model_api_v1_semantic_models_add_post`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes |  |
| `package_id` | `string` | Yes |  |
| `description` | `string` | No |  |
| `file` | `string` | Yes |  |

### `Body_create_package_api_v1_packages_create_post`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes |  |
| `description` | `string` | No |  |

### `Body_login_for_access_token_api_v1_auth_login_post`

| Field | Type | Required | Description |
|---|---|---|---|
| `grant_type` | `object` | No |  |
| `username` | `string` | Yes |  |
| `password` | `string` | Yes |  |
| `scope` | `string` | No |  |
| `client_id` | `object` | No |  |
| `client_secret` | `object` | No |  |

### `ConnectionCreate`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes |  |
| `description` | `object` | No |  |
| `type` | `string` | Yes |  |
| `connection_attributes` | `object` | Yes |  |

### `ConnectionPublicResponse`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes |  |
| `type` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `description` | `object` | No |  |
| `created_at` | `string` | Yes |  |
| `updated_at` | `string` | Yes |  |
| `created_by` | `string` | Yes |  |
| `updated_by` | `string` | Yes |  |
| `is_active` | `boolean` | Yes |  |

### `ConnectionUpdate`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `object` | No |  |
| `description` | `object` | No |  |
| `connection_attributes` | `object` | No |  |

### `DashboardCreate`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes |  |
| `description` | `string` | Yes |  |

### `DashboardPublicResponse`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `description` | `string` | Yes |  |
| `created_at` | `string` | Yes |  |
| `updated_at` | `string` | Yes |  |
| `created_by` | `string` | Yes |  |
| `updated_by` | `string` | Yes |  |
| `config_file` | `string` | Yes |  |

### `DashboardUpdate`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `object` | No |  |
| `description` | `object` | No |  |
| `config_file` | `object` | No |  |

### `HTTPValidationError`

| Field | Type | Required | Description |
|---|---|---|---|
| `detail` | `array[ValidationError]` | No |  |

### `OwnerCreate`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes |  |
| `description` | `string` | Yes |  |
| `username` | `string` | Yes |  |
| `email` | `string` | Yes |  |
| `password` | `string` | Yes |  |
| `first_name` | `string` | Yes |  |
| `last_name` | `string` | Yes |  |

### `PackageResponse`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `location` | `string` | Yes |  |
| `created_at` | `string` | Yes |  |
| `updated_at` | `string` | Yes |  |
| `created_by` | `string` | Yes |  |
| `updated_by` | `string` | Yes |  |
| `is_active` | `boolean` | Yes |  |

### `UserCreate`

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | `string` | Yes |  |
| `first_name` | `string` | Yes |  |
| `last_name` | `string` | Yes |  |
| `password` | `object` | No |  |
| `permissions` | `object` | No |  |

### `UserPermissions`

No properties.

### `UserPublicResponse`

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | `string` | Yes |  |
| `first_name` | `string` | Yes |  |
| `last_name` | `string` | Yes |  |
| `id` | `string` | Yes |  |
| `is_active` | `boolean` | Yes |  |
| `role` | `string` | Yes |  |
| `email` | `object` | No |  |
| `permissions` | `object` | No |  |
| `created_at` | `string` | Yes |  |
| `updated_at` | `string` | Yes |  |
| `created_by` | `object` | No |  |
| `updated_by` | `object` | No |  |

### `UserUpdate`

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `object` | No |  |
| `username` | `object` | No |  |
| `first_name` | `object` | No |  |
| `last_name` | `object` | No |  |
| `role` | `object` | No |  |
| `permissions` | `object` | No |  |
| `is_active` | `object` | No |  |
| `is_password_set` | `object` | No |  |

### `ValidationError`

| Field | Type | Required | Description |
|---|---|---|---|
| `loc` | `array[object]` | Yes |  |
| `msg` | `string` | Yes |  |
| `type` | `string` | Yes |  |
| `input` | `object` | No |  |
| `ctx` | `object` | No |  |
