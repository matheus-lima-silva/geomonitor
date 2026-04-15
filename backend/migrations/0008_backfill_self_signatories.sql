-- 0008_backfill_self_signatories.sql
-- Para cada usuario existente sem entrada em user_signatories, criar um signatario
-- usando os dados de assinatura embarcados no payload JSONB do usuario.
-- Isto unifica a fonte de signatarios em user_signatories, eliminando a
-- duplicacao entre "Minha Assinatura" (user.payload) e "Signatarios Frequentes".

INSERT INTO user_signatories (
    user_id,
    nome,
    profissao_id,
    registro_conselho,
    registro_estado,
    registro_numero,
    registro_sufixo
)
SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.payload->>'nome'), ''), u.payload->>'email', u.id),
    NULLIF(u.payload->>'profissao_id', ''),
    COALESCE(u.payload->>'registro_conselho', ''),
    COALESCE(u.payload->>'registro_estado', ''),
    COALESCE(u.payload->>'registro_numero', ''),
    COALESCE(u.payload->>'registro_sufixo', '')
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_signatories s WHERE s.user_id = u.id
);
