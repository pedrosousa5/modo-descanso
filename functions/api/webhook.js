/**
 * Webhook Receptor de Vendas (Hotmart, Kiwify e outros gateways)
 * Rota: POST /api/webhook
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();

        // 1. Identificação e extração dos dados conforme o gateway (Hotmart vs Kiwify)
        let email = '';
        let name = '';
        let phone = '';
        let orderId = '';
        let platform = 'hotmart';
        let rawStatus = '';

        // Formato Hotmart (Webhook 2.0 / Postback clássico)
        if (body.data && body.data.buyer) {
            const buyer = body.data.buyer;
            const purchase = body.data.purchase || {};
            email = (buyer.email || '').trim().toLowerCase();
            name = buyer.name || '';
            phone = buyer.checkout_phone || '';
            orderId = purchase.transaction || body.id || '';
            rawStatus = (purchase.status || body.event || '').toLowerCase();
            platform = 'hotmart';
        } else if (body.event && body.event.includes('PURCHASE')) {
            // Eventos estilo PURCHASE_APPROVED
            rawStatus = body.event.toLowerCase();
            const buyer = (body.data && body.data.buyer) || body.buyer || {};
            email = (buyer.email || '').trim().toLowerCase();
            name = buyer.name || '';
            orderId = (body.data && body.data.purchase && body.data.purchase.transaction) || '';
            platform = 'hotmart';
        } else {
            // Formato Kiwify padrão
            const customer = body.Customer || body.customer || {};
            email = (customer.email || body.email || '').trim().toLowerCase();
            name = customer.full_name || customer.name || body.name || '';
            phone = customer.mobile || customer.phone || body.phone || '';
            orderId = body.order_id || body.id || '';
            rawStatus = (body.order_status || body.status || '').toLowerCase();
            platform = 'kiwify';
        }

        if (!email) {
            return new Response(JSON.stringify({ error: 'E-mail do comprador não localizado no payload' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Mapeamento de status: Aprovado -> active | Reembolso -> refunded
        let buyerStatus = 'active';
        if (
            rawStatus.includes('refund') || 
            rawStatus.includes('reembolsado') || 
            rawStatus.includes('canceled') || 
            rawStatus.includes('chargeback')
        ) {
            buyerStatus = 'refunded';
        } else if (
            rawStatus.includes('approved') || 
            rawStatus.includes('paid') || 
            rawStatus.includes('complete') ||
            rawStatus === ''
        ) {
            buyerStatus = 'active';
        } else {
            buyerStatus = 'pending';
        }

        // 3. Gravação no Cloudflare D1
        if (env.DB) {
            const query = `
                INSERT INTO buyers (email, name, phone, status, platform, order_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(email) DO UPDATE SET
                    status = excluded.status,
                    name = COALESCE(excluded.name, buyers.name),
                    phone = COALESCE(excluded.phone, buyers.phone),
                    platform = excluded.platform,
                    order_id = COALESCE(excluded.order_id, buyers.order_id),
                    updated_at = CURRENT_TIMESTAMP;
            `;
            await env.DB.prepare(query).bind(email, name, phone, buyerStatus, platform, orderId).run();
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Acesso atualizado para ${email} [${platform}] com status: ${buyerStatus}` 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
