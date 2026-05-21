/**
 * Role-based access control middleware.
 *
 * Usage (always place after auth middleware):
 *   router.post('/admin-only', auth, authorize('admin'), handler)
 *   router.get('/both',        auth, authorize('admin', 'manager'), handler)
 *
 * Roles:
 *   admin   — full access: manage users, stores, credentials, reservations
 *   manager — operational access: view stores, accept/reject reservations
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: requires one of [${roles.join(", ")}] role`,
      });
    }
    return next();
  };

module.exports = authorize;
