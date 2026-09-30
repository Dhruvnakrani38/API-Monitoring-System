// System mein maanay jaane wale tamam role names yahan listed hain.
export const ROLES = [
    'super_admin',
    'client_admin',
    'client_viewer',
];

// Client account ke andar assign kiye ja sakne wale roles ki list hai.
export const CLIENT_ROLES = [
    'client_admin',
    'client_viewer',
];

// Named constants role strings ko code mein consistent rakhti hain.
export const APPLICATION_ROLES = {
    SUPER_ADMIN: "super_admin",
    CLIENT_VIEWER: "client_viewer",
    CLIENT_ADMIN: "client_admin"
}

// Check karta hai ki role client-level role list mein maujood hai.
export const isValidClientRole = (role) => CLIENT_ROLES.includes(role);
// Check karta hai ki role kisi bhi supported application role mein hai.
export const isValidRole = (role) => ROLES.includes(role);