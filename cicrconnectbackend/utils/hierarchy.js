const parseYear = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isAdminOrHead = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'head';
};

const canManageJunior = (actor, target) => {
  if (!actor || !target) return false;
  if (isAdminOrHead(actor)) return true;

  const actorYear = parseYear(actor.year);
  const targetYear = parseYear(target.year);
  if (!actorYear || !targetYear) return false;

  // Hierarchy rule: seniors (2nd year+) can manage same or junior years.
  return actorYear >= 2 && targetYear <= actorYear;
};

const validateHierarchyTeam = (actor, members) => {
  if (isAdminOrHead(actor)) {
    return { allowed: true, reason: '' };
  }

  const actorYear = parseYear(actor?.year);
  if (!actorYear || actorYear < 2) {
    return { allowed: false, reason: 'Only seniors (2nd year and above) can perform this action.' };
  }

  const invalid = members.find((m) => {
    const memberYear = parseYear(m?.year);
    if (!memberYear) return true;
    return memberYear > actorYear;
  });

  if (invalid) {
    return {
      allowed: false,
      reason: 'You can only assign or manage members from your year or junior years.',
    };
  }

  return { allowed: true, reason: '' };
};

module.exports = {
  parseYear,
  isAdminOrHead,
  canManageJunior,
  validateHierarchyTeam,
};
