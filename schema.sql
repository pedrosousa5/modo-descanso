-- Tabela de Praticantes Autorizados do Modo Descanso
CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'refunded', 'chargedback'
    platform TEXT DEFAULT 'kiwify', -- 'kiwify', 'hotmart', 'stripe', 'manual'
    order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca instantânea por e-mail na hora do login
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);
