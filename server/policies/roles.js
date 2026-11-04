const USER_ROLES = Object.freeze(["administrador", "coordinador"]);
function isSupportedRole(role) { return USER_ROLES.includes(role); }
module.exports = { USER_ROLES, isSupportedRole };
