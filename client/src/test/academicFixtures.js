export const academicCareers = [
  { _id: "career-computing", nombre: "Computación", totalNiveles: 9, unidadNivel: "semestre", activa: true },
  { _id: "career-admin", nombre: "Gestión administrativa", totalNiveles: 4, unidadNivel: "anio", activa: true },
];
export const sampleStudent = { _id: "student1", studentId: "TEST001", name: "Ana Ficticia", email: "ana@example.test", phone: "+593999999999", careerId: academicCareers[0]._id, career: academicCareers[0], nivelAcademico: 1, createdAt: "2020-01-01T00:00:00Z" };
