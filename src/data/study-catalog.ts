// Demo catalog only. Replace this adapter with the public WordPress catalog;
// these IDs must never be submitted to the production subscription endpoint.
export const programs = [
  { id: "demo-mi", name: "Diplomirani matematičar i informatičar", level: "Osnovne studije", years: 4 },
  { id: "demo-i", name: "Diplomirani informatičar", level: "Osnovne studije", years: 4 },
  { id: "demo-pmi", name: "Diplomirani profesor matematike i informatike", level: "Osnovne studije", years: 4 },
  { id: "demo-ma", name: "Matematička analiza i primjene", level: "Master studije", years: 1 },
  { id: "demo-ag", name: "Algebra i geometrija", level: "Master studije", years: 1 },
  { id: "demo-dm", name: "Doktor matematičkih nauka", level: "Doktorske studije", years: 3 },
];

export const courses = [
  { id: "demo-mi-1-analysis", programId: "demo-mi", year: 1, name: "Matematička analiza 1" },
  { id: "demo-mi-1-programming", programId: "demo-mi", year: 1, name: "Uvod u programiranje" },
  { id: "demo-mi-2-algebra", programId: "demo-mi", year: 2, name: "Linearna algebra" },
  { id: "demo-i-1-programming", programId: "demo-i", year: 1, name: "Uvod u programiranje" },
  { id: "demo-i-1-discrete", programId: "demo-i", year: 1, name: "Diskretna matematika" },
  { id: "demo-i-2-algorithms", programId: "demo-i", year: 2, name: "Algoritmi i strukture podataka" },
  { id: "demo-pmi-1-analysis", programId: "demo-pmi", year: 1, name: "Matematička analiza 1" },
  { id: "demo-pmi-2-pedagogy", programId: "demo-pmi", year: 2, name: "Pedagogija" },
  { id: "demo-ma-1-analysis", programId: "demo-ma", year: 1, name: "Funkcionalna analiza" },
  { id: "demo-ag-1-algebra", programId: "demo-ag", year: 1, name: "Apstraktna algebra" },
  { id: "demo-dm-1-research", programId: "demo-dm", year: 1, name: "Istraživački seminar" },
];
