const YEAR_MIN = 2000;
const YEAR_MAX = 2100;
const MAX_TENURE_WINDOW_YEARS = 4;

const trimText = (value, max = 160) => String(value || '').trim().slice(0, max);

const parseOptionalYear = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
};

const normalizeTenures = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const fromYear = parseOptionalYear(row?.fromYear);
      const toYear = parseOptionalYear(row?.toYear);
      return {
        position: trimText(row?.position, 80),
        fromYear,
        toYear,
      };
    })
    .filter((row) => row.position || row.fromYear || row.toYear)
    .sort((a, b) => {
      const aFrom = a.fromYear || YEAR_MAX;
      const bFrom = b.fromYear || YEAR_MAX;
      if (aFrom !== bFrom) return aFrom - bFrom;
      const aTo = a.toYear || YEAR_MAX;
      const bTo = b.toYear || YEAR_MAX;
      return aTo - bTo;
    });
};

const validateTenures = (tenures = []) => {
  if (!Array.isArray(tenures)) return { ok: false, message: 'Invalid tenure data.' };
  if (tenures.length > 12) return { ok: false, message: 'Too many tenure records.' };

  for (let i = 0; i < tenures.length; i += 1) {
    const row = tenures[i];
    const idx = i + 1;
    if (!row.position) return { ok: false, message: `Tenure #${idx}: position is required.` };
    if (!Number.isFinite(row.fromYear) || !Number.isFinite(row.toYear)) {
      return { ok: false, message: `Tenure #${idx}: both start and end year are required.` };
    }
    if (row.fromYear < YEAR_MIN || row.fromYear > YEAR_MAX || row.toYear < YEAR_MIN || row.toYear > YEAR_MAX) {
      return { ok: false, message: `Tenure #${idx}: year must be between ${YEAR_MIN} and ${YEAR_MAX}.` };
    }
    if (row.toYear < row.fromYear) {
      return { ok: false, message: `Tenure #${idx}: end year cannot be earlier than start year.` };
    }
    if (row.toYear - row.fromYear > MAX_TENURE_WINDOW_YEARS - 1) {
      return { ok: false, message: `Tenure #${idx}: a CICR tenure cannot exceed ${MAX_TENURE_WINDOW_YEARS} years.` };
    }
  }

  if (tenures.length > 0) {
    const minFrom = Math.min(...tenures.map((row) => row.fromYear));
    const maxTo = Math.max(...tenures.map((row) => row.toYear));
    if (maxTo - minFrom > MAX_TENURE_WINDOW_YEARS - 1) {
      return {
        ok: false,
        message: `Combined CICR timeline cannot exceed ${MAX_TENURE_WINDOW_YEARS} years for one member.`,
      };
    }
  }

  return { ok: true };
};

const normalizeAlumniProfile = (incoming = {}, current = {}) => {
  const nextSource = incoming && typeof incoming === 'object' ? incoming : {};
  const currentSource = current && typeof current === 'object' ? current : {};

  const tenures =
    Object.prototype.hasOwnProperty.call(nextSource, 'tenures')
      ? normalizeTenures(nextSource.tenures)
      : normalizeTenures(currentSource.tenures || []);

  const graduationYearRaw = Object.prototype.hasOwnProperty.call(nextSource, 'graduationYear')
    ? nextSource.graduationYear
    : currentSource.graduationYear;
  const graduationYear = parseOptionalYear(graduationYearRaw);

  const willingToMentor = Object.prototype.hasOwnProperty.call(nextSource, 'willingToMentor')
    ? Boolean(nextSource.willingToMentor)
    : Boolean(currentSource.willingToMentor);

  const mentorshipAreasSource = Object.prototype.hasOwnProperty.call(nextSource, 'mentorshipAreas')
    ? nextSource.mentorshipAreas
    : currentSource.mentorshipAreas;
  const mentorshipAreas = Array.isArray(mentorshipAreasSource)
    ? mentorshipAreasSource.map((v) => trimText(v, 60)).filter(Boolean).slice(0, 20)
    : [];

  const availabilityMode = trimText(
    Object.prototype.hasOwnProperty.call(nextSource, 'availabilityMode')
      ? nextSource.availabilityMode
      : currentSource.availabilityMode,
    32
  );
  const safeAvailabilityMode = ['Flexible', 'Weekends', 'Evenings', 'Limited', 'Unavailable'].includes(availabilityMode)
    ? availabilityMode
    : 'Flexible';

  return {
    tenures,
    graduationYear:
      Number.isFinite(graduationYear) && graduationYear >= YEAR_MIN && graduationYear <= YEAR_MAX
        ? graduationYear
        : null,
    currentOrganization: trimText(
      Object.prototype.hasOwnProperty.call(nextSource, 'currentOrganization')
        ? nextSource.currentOrganization
        : currentSource.currentOrganization,
      140
    ),
    currentDesignation: trimText(
      Object.prototype.hasOwnProperty.call(nextSource, 'currentDesignation')
        ? nextSource.currentDesignation
        : currentSource.currentDesignation,
      100
    ),
    location: trimText(
      Object.prototype.hasOwnProperty.call(nextSource, 'location')
        ? nextSource.location
        : currentSource.location,
      120
    ),
    willingToMentor,
    mentorshipAreas,
    availabilityMode: safeAvailabilityMode,
    notableProjects: trimText(
      Object.prototype.hasOwnProperty.call(nextSource, 'notableProjects')
        ? nextSource.notableProjects
        : currentSource.notableProjects,
      600
    ),
  };
};

module.exports = {
  YEAR_MIN,
  YEAR_MAX,
  MAX_TENURE_WINDOW_YEARS,
  normalizeAlumniProfile,
  normalizeTenures,
  validateTenures,
};

