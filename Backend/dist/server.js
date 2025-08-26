"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = 8080;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
app.listen(port, () => {
    console.log(`Listning on port ${port}`);
});
