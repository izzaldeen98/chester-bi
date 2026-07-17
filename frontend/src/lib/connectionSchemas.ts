
export const PostgresMySqlSchema = {

    fields : [
        {
            name : "host",
            inputType : "text",
            label : "Host",
            placeholder : "Enter host",
            required : true,
        },
        {
            name : "port",
            inputType : "number",
            label : "Port",
            placeholder : "Enter port",
            required : true,
        },
        
        {
            name : "database",
            inputType : "text",
            label : "Database",
            placeholder : "Enter database",
            required : true,
        },
        
        {
            name : "username",
            inputType : "text",
            label : "Username",
            placeholder : "Enter username",
            required : true,
        },

        {
            name : "password",
            inputType : "password",
            label : "Password",
            placeholder : "Enter password",
            required : true,
        },
    ]
}

export const SnowflakeSchema = {
    fields : [
        {
            name : "account",
            inputType : "text",
            label : "Account",
            placeholder : "Enter account",
            required : true,
        },
        {
            name : "username",
            inputType : "text",
            label : "Username",
            placeholder : "Enter username",
            required : true,
        },
        {
            name : "password",
            inputType : "password",
            label : "Password",
            placeholder : "Enter password",
            required : false,
        },
        {
            name : "database",
            inputType : "text",
            label : "Database",
            placeholder : "Enter database",
            required : false,
        },
        {
            name : "schema",
            inputType : "text",
            label : "Schema",
            placeholder : "Enter schema",
            required : false,
        },
        {
            name : "warehouse",
            inputType : "text",
            label : "Warehouse",
            placeholder : "Enter warehouse",
            required : true,
        },
        {
            name : "private_key",
            inputType : "text",
            label : "Private Key",
            placeholder : "Enter private key",
            required : false,
        },
        {
            name : "private_key_passphrase",
            inputType : "text",
            label : "Private Key Passphrase",
            placeholder : "Enter private key passphrase",
            required : false,
        },
    ]
}

export const BigQuerySchema = {
    fields : [
        {
            name : "project_id",
            inputType : "text",
            label : "Project ID",
            placeholder : "Enter project ID",
            required : true,
        },
        {
            name : "credentials",
            inputType : "text",
            label : "Credentials",
            placeholder : "Enter credentials JSON",
            required : true,
        }
    ]
}
