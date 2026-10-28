/**
 * Webhook Receptor de Vendas (Kiwify e outros gateways)
 * Rota: POST /api/webhook
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();

        // Extração dos dados do cliente (formato Kiwify padrão)
        // Kiwify envia: { order_status: 'paid', Customer: { email, full_name, mobile }, order_id }
        const orderStatus = (body.order_status || '').toLowerCase();
        const customer = body.Customer || body.customer || {};
        const email = (customer.email || body.email || '').trim().toLowerCase();
        const name = customer.full_name || customer.name || body.name || '';
        const phone = customer.mobile || customer.phone || body.phone || '';
        const orderId = body.order_id || body.id || '';

        if (!email) {
            return new Response(JSON.stringify({ error: 'E-mail do cliente não fornecido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Mapeamento de status: paid/approved -> active; refunded/chargeback -> refunded
        let buyerStatus = 'active';
        if (orderStatus.includes('refund') || orderStatus.includes('reembolsado')) {
            buyerStatus = 'refunded';
        } else if (orderStatus.includes('chargeback')) {
            buyerStatus = 'chargedback';
        } else if (orderStatus !== 'paid' && orderStatus !== 'approved' && orderStatus !== '') {
            // Outros status como aguardando pagamento
            buyerStatus = 'pending';
        }

        // Gravação no Cloudflare D1
        if (env.DB) {
            const query = `
                INSERT INTO buyers (email, name, phone, status, platform, order_id, updated_at)
                VALUES (?, ?, ?, ?, 'kiwify', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(email) DO UPDATE SET
                    status = excluded.status,
                    name = COALESCE(excluded.name, buyers.name),
                    order_id = COALESCE(excluded.order_id, buyers.order_id),
                    updated_at = CURRENT_TIMESTAMP;
            `;
            await env.DB.prepare(query).bind(email, name, phone, buyerStatus, orderId).run();
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Acesso atualizado para ${email} com status: ${buyerStatus}` 
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
