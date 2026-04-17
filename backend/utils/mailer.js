const nodemailer = require('nodemailer');

function getMailTransport() {
    const host = process.env.SMTP_HOST;
    if (!host) return null;

    return nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/**
 * Envia um email de redefinição de senha.
 *
 * @param {object} transport  - Instância do transporte nodemailer
 * @param {string} email      - Destinatário
 * @param {string} resetToken - Token gerado aleatoriamente
 * @param {number} expiryHours - Horas até expiração (usado no corpo do email)
 */
async function sendResetEmail(transport, email, resetToken, expiryHours = 1) {
    const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const text = [
        'Olá,',
        '',
        'Recebemos uma solicitação para redefinir sua senha no GeoMonitor.',
        '',
        'Acesse o link abaixo para criar uma nova senha:',
        resetLink,
        '',
        `Este link expira em ${expiryHours} hora(s).`,
        '',
        'Se você não solicitou essa alteração, ignore este email.',
    ].join('\n');

    const html = `
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir sua senha no GeoMonitor.</p>
            <p><a href="${resetLink}" style="font-weight:bold">Clique aqui para redefinir sua senha</a></p>
            <p style="font-size:12px;color:#64748b">Se o botão acima não funcionar, copie e cole a URL abaixo no seu navegador:</p>
            <p style="font-size:12px;word-break:break-all"><a href="${resetLink}">${resetLink}</a></p>
            <p>Este link expira em ${expiryHours} hora(s).</p>
            <p>Se você não solicitou essa alteração, ignore este email.</p>
        `;

    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'GeoMonitor — Redefinição de senha',
        text,
        html,
    });
}

/**
 * Envia o email de reset para contas pre-existentes que ainda nao definiram senha.
 * Usado quando o backend detecta um perfil sem `auth_credentials` associados.
 */
async function sendMigrationResetEmail(transport, email, resetToken, expiryHours = 48) {
    const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const text = [
        'Olá,',
        '',
        'O GeoMonitor atualizou seu sistema de autenticação. Para continuar acessando a plataforma, você precisa redefinir sua senha.',
        '',
        'Acesse o link abaixo para criar uma nova senha:',
        resetLink,
        '',
        `Este link expira em ${expiryHours} horas.`,
        '',
        'Se você tiver dúvidas, entre em contato com o administrador do sistema.',
    ].join('\n');

    const html = `
            <p>Olá,</p>
            <p>O GeoMonitor atualizou seu sistema de autenticação. Para continuar acessando a plataforma, você precisa redefinir sua senha.</p>
            <p><a href="${resetLink}" style="font-weight:bold">Clique aqui para redefinir sua senha</a></p>
            <p style="font-size:12px;color:#64748b">Se o botão acima não funcionar, copie e cole a URL abaixo no seu navegador:</p>
            <p style="font-size:12px;word-break:break-all"><a href="${resetLink}">${resetLink}</a></p>
            <p>Este link expira em ${expiryHours} horas.</p>
            <p>Se você tiver dúvidas, entre em contato com o administrador do sistema.</p>
        `;

    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'GeoMonitor — Ação necessária: redefina sua senha',
        text,
        html,
    });
}

module.exports = { getMailTransport, sendResetEmail, sendMigrationResetEmail };
