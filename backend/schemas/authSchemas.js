const { z } = require('zod');

// Regras espelham validateEmail/validatePassword em routes/auth.js. Mantenha
// sincronizado quando as regras mudarem.
const emailSchema = z
    .string()
    .trim()
    .min(1, 'Email e obrigatorio.')
    .email('Email invalido.');

const strongPasswordSchema = z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiuscula.')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minuscula.')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um numero.');

const registerSchema = z.object({
    email: emailSchema,
    password: strongPasswordSchema,
    nome: z.string().trim().min(1, 'Nome e obrigatorio.'),
});

const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Senha e obrigatoria.'),
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token e obrigatorio.'),
});

const resetPasswordRequestSchema = z.object({
    email: z.string().trim().optional().default(''),
});

const resetPasswordConfirmSchema = z.object({
    token: z.string().min(1, 'Token e obrigatorio.'),
    newPassword: strongPasswordSchema,
});

module.exports = {
    registerSchema,
    loginSchema,
    refreshSchema,
    resetPasswordRequestSchema,
    resetPasswordConfirmSchema,
};
