     // ./lib/prisma.js
     import { PrismaClient } from "./generated/prisma/client";

     const prisma = global.prisma || new PrismaClient();

     if (process.env.NODE_ENV !== "production") {
       global.prisma = prisma;
     }

     export { prisma as db };  // Named export: Export 'prisma' as 'db'
     export default prisma;