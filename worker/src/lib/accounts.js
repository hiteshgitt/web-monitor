// Removing a customer, used by self-service deletion and by the super admin. The privacy policy and the
// /delete-account page describe exactly this list, so change them together.
// Kept on purpose: paid billing_orders (tax records, no email in them) and the admin_audit log.
export function deleteCustomerStatements(db, userId) {
  const ownSites = 'SELECT id FROM websites WHERE owner_id = ?';
  return [
    ...['check_hours', 'check_days', 'incidents', 'vitals_scans', 'security_scans'].map((table) => (
      db.prepare(`DELETE FROM ${table} WHERE website_id IN (${ownSites})`).bind(userId)
    )),
    db.prepare('DELETE FROM websites WHERE owner_id = ?').bind(userId),
    ...['ga_pending', 'sc_pending', 'notifications', 'push_devices'].map((table) => (
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId)
    )),
    db.prepare("DELETE FROM billing_orders WHERE user_id = ? AND status != 'paid'").bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ];
}
