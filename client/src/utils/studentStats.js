export function studentStats(students, careers = [], now = new Date()) {
  return {
    total: students.length,
    levels: new Set(students.filter(student => student.careerId && student.nivelAcademico).map(student => `${student.careerId}:${student.nivelAcademico}`)).size,
    activeCareers: careers.filter(career => career.activa).length,
    newThisMonth: students.filter(student => {
      if (!student.createdAt) return false;
      const created = new Date(student.createdAt);
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && created <= now;
    }).length,
  };
}
