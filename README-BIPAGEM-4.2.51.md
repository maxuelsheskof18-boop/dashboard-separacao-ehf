# Bipagem 4.2.51 — captura rápida assíncrona

- O leitor nunca espera busca no Tiny nem planilha.
- Duplicidade é bloqueada imediatamente no navegador e novamente no Gateway por dia operacional.
- Cada leitura recebe um ID interno do Gateway.
- A fila local fica em localStorage e tenta reenviar se a internet oscilar.
- O Gateway resolve pedido/rastreio em segundo plano.
- O painel atualiza Identificando e Planilha sem travar o campo.
- O romaneio inclui quantidade física, faixa/IDs de bipagem e assinatura do coletor.

Requer Gateway 3.4.16 ou superior para usar /capturar.
