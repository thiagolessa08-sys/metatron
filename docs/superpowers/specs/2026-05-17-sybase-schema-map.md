# Schema Map — metatron

**Gerado em:** 2026-05-17
**Usuário Java Agent:** `iaapi`
**Pendente:** GRANT SELECT ON metatron.* TO iaapi (executar no Sybase IQ)

---

## Tabelas do Schema `metatron`

### `metatron.TT_ACIONAMENTOS_METATRON`
Registro de cada ligação/acionamento realizado.

| Coluna | Tipo | Nullable |
|--------|------|----------|
| `campanha` | varchar | ✓ |
| `cpf` | varchar | ✓ |
| `telefone` | varchar | ✓ |
| `data` | varchar | ✓ |
| `hora` | varchar | ✓ |
| `duracao` | integer | ✓ |
| `operador` | varchar | ✓ |
| `descricao` | varchar | ✓ |
| `desligou` | varchar | ✓ |

**Uso:** Relatório de Qualificações, filtros de campanha/operador/período.

---

### `metatron.TT_METRICAS_METATRON`
Métricas agregadas por campanha/fila (aproveitamento de listas).

| Coluna | Tipo | Nullable |
|--------|------|----------|
| `id` | varchar | ✓ |
| `empresa` | varchar | ✓ |
| `fila` | varchar | ✓ |
| `campanha` | varchar | ✓ |
| `total` | varchar | ✓ |
| `localizados` | varchar | ✓ |
| `em_contato` | varchar | ✓ |
| `novos` | varchar | ✓ |
| `resets` | varchar | ✓ |
| `agendamentos_publicos` | varchar | ✓ |
| `agendamentos_privados` | varchar | ✓ |
| `aproveitamento` | double/varchar | ✓ |
| `hora` | varchar | ✓ |
| `contatados` | varchar | ✓ |
| `descartados` | varchar | ✓ |
| `atualiza` | varchar | ✓ |
| `higieniza` | varchar | ✓ |
| `ativo` | varchar | ✓ |
| `servidor` | varchar | ✓ |
| `discados_total` | varchar | ✓ |
| `atendidas_hoje` | varchar | ✓ |

**Uso:** Relatório de Aproveitamento, KPIs de listas.

---

### `metatron.TT_RELATORIO_METATRON`
Detalhamento de chamadas com tarifação.

| Coluna | Tipo | Nullable |
|--------|------|----------|
| `data_hora` | varchar | ✓ |
| `numero` | varchar | ✓ |
| `TechPrefix` | varchar | ✓ |
| `Tipo_Numero` | varchar | ✓ |
| `Operadora` | varchar | ✓ |
| `tarifa` | varchar | ✓ |
| `resultado` | varchar | ✓ |
| `codigo_desligamento` | varchar | ✓ |
| `duracao` | varchar | ✓ |
| `Dur_Min` | varchar | ✓ |
| `Dur_Min_Tarif` | varchar | ✓ |
| `Valor` | varchar | ✓ |

**Uso:** Relatório de Chamadas, análise de custo por operadora.

---

## Mapeamento Lógico

| Entidade Lógica | Tabela Real |
|-----------------|-------------|
| Ligações/Acionamentos | `metatron.TT_ACIONAMENTOS_METATRON` |
| Qualificações | `metatron.TT_ACIONAMENTOS_METATRON.descricao` |
| Agentes/Operadores | `metatron.TT_ACIONAMENTOS_METATRON.operador` |
| Campanhas | `metatron.TT_ACIONAMENTOS_METATRON.campanha` |
| Aproveitamento/Métricas | `metatron.TT_METRICAS_METATRON` |
| Tarifação/Chamadas | `metatron.TT_RELATORIO_METATRON` |

## Pendências

- [ ] GRANT SELECT ON metatron.TT_ACIONAMENTOS_METATRON TO iaapi
- [ ] GRANT SELECT ON metatron.TT_METRICAS_METATRON TO iaapi
- [ ] GRANT SELECT ON metatron.TT_RELATORIO_METATRON TO iaapi
- [ ] Confirmar formato da coluna `data` (ex: 'DD/MM/YYYY' ou 'YYYY-MM-DD')
- [ ] Confirmar valores de `descricao` (qualificações reais)
- [ ] Confirmar se `aproveitamento` é percentual (0-100) ou fração (0-1)
