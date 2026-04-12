const { getFullYearsOfService, getYearsOfService, getMonthsOfService, parseDate, formatDate } = require('../utils/dateUtils');

/**
 * Calculate monthly leave for employees under 1 year of service.
 * Awards 1 day per complete month worked, max 11 days in the first year.
 *
 * @param {string} hireDate YYYY-MM-DD
 * @param {number} targetYear
 * @returns {{ totalDays: number, calcDetail: object }}
 */
function calculateMonthlyLeave(hireDate, targetYear) {
  const yearStart = `${targetYear}-01-01`;
  const yearEnd = `${targetYear}-12-31`;
  const hire = parseDate(hireDate);

  // The effective start for counting is the later of hireDate or yearStart
  const effectiveStart = hireDate > yearStart ? hireDate : yearStart;
  // The 1-year anniversary
  const oneYearAnniversary = `${hire.getFullYear() + 1}-${String(hire.getMonth() + 1).padStart(2, '0')}-${String(hire.getDate()).padStart(2, '0')}`;

  // The effective end for monthly leave is the earlier of yearEnd or (1-year anniversary - 1 day)
  const effectiveEnd = oneYearAnniversary <= yearEnd ? oneYearAnniversary : yearEnd;

  // Count complete months from hire date up to the effective end
  const months = getMonthsOfService(hireDate, effectiveEnd);
  const totalDays = Math.min(months, 11);

  return {
    totalDays,
    calcDetail: {
      hireDate,
      targetYear,
      method: 'monthly',
      monthsWorked: months,
      formula: `입사 1년 미만: 근무 개월 수(${months}개월) × 1일 (최대 11일)`,
      totalDays
    }
  };
}

/**
 * Calculate annual leave entitlement based on Korean Labor Standards Act.
 *
 * Rules:
 * - < 1 year of service: 1 day per month worked (max 11)
 * - 1+ years: 15 days base
 * - 3+ years: +1 day for every 2 years beyond the first year
 *   i.e., at 3 years: +1, at 5 years: +2, at 7 years: +3 ...
 * - Maximum: 25 days
 *
 * @param {string} hireDate YYYY-MM-DD
 * @param {number} targetYear
 * @returns {{ totalDays: number, calcDetail: object }}
 */
function calculateAnnualLeave(hireDate, targetYear) {
  // Reference date: January 1 of target year
  const referenceDate = `${targetYear}-01-01`;
  const yearsOfService = getYearsOfService(hireDate, referenceDate);
  const fullYears = getFullYearsOfService(hireDate, referenceDate);

  // If hire date is in the future relative to target year start
  if (hireDate >= `${targetYear + 1}-01-01`) {
    return {
      totalDays: 0,
      calcDetail: {
        hireDate,
        targetYear,
        yearsOfService: 0,
        fullYears: 0,
        formula: '대상 연도에 재직하지 않음',
        totalDays: 0
      }
    };
  }

  // If hired in the target year itself, use monthly calculation
  if (hireDate >= referenceDate) {
    return calculateMonthlyLeave(hireDate, targetYear);
  }

  // Less than 1 full year of service at start of target year
  if (fullYears < 1) {
    // Mixed year: part monthly, part annual
    // Monthly leave portion: from Jan 1 to 1-year anniversary (or already used calculateMonthlyLeave)
    // After 1-year anniversary: the employee gets 15 days for the period after anniversary
    // However, standard practice: for the target year, if the employee will complete 1 year during the year,
    // they get 15 days for that year (applied from anniversary).
    // Simplified approach used in most Korean payroll: give 15 days for the year in which 1-year anniversary falls.
    // We'll use the simpler model: if they pass 1-year mark in this target year, give 15 days.
    const hire = parseDate(hireDate);
    const anniversaryInTargetYear = `${targetYear}-${String(hire.getMonth() + 1).padStart(2, '0')}-${String(hire.getDate()).padStart(2, '0')}`;

    if (anniversaryInTargetYear <= `${targetYear}-12-31`) {
      // Will complete 1 year during target year → 15 days
      return {
        totalDays: 15,
        calcDetail: {
          hireDate,
          targetYear,
          yearsOfService: parseFloat(yearsOfService.toFixed(2)),
          fullYears,
          formula: `대상 연도 중 1년 근속 달성 예정(${anniversaryInTargetYear}) → 15일`,
          totalDays: 15
        }
      };
    }

    // Won't complete 1 year in target year → monthly
    return calculateMonthlyLeave(hireDate, targetYear);
  }

  // 1+ full years of service
  let totalDays = 15;
  let bonusDays = 0;
  let formula = '기본 15일';

  if (fullYears >= 3) {
    // +1 day for every 2 years beyond the first year
    // At 3 years: (3-1)/2 = 1 → +1
    // At 5 years: (5-1)/2 = 2 → +2
    // At 7 years: (7-1)/2 = 3 → +3
    bonusDays = Math.floor((fullYears - 1) / 2);
    totalDays = 15 + bonusDays;
    formula = `기본 15일 + 장기근속 가산 ${bonusDays}일 (근속 ${fullYears}년, (${fullYears}-1)/2 = ${bonusDays})`;
  }

  // Cap at 25
  if (totalDays > 25) {
    totalDays = 25;
    formula += ' → 상한 25일 적용';
  }

  return {
    totalDays,
    calcDetail: {
      hireDate,
      targetYear,
      yearsOfService: parseFloat(yearsOfService.toFixed(2)),
      fullYears,
      bonusDays: bonusDays || 0,
      formula,
      totalDays
    }
  };
}

module.exports = {
  calculateAnnualLeave,
  calculateMonthlyLeave
};
