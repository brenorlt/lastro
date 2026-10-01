# Lastro — Design System

> Página viva: `http://localhost:3100/design-system` · Tokens: `frontend/src/app/globals.css`

## Tese

**Lastro** é o que dá valor a uma moeda: o que existe por trás dela. A interface é silenciosa (superfícies
neutras, tinta quase preta, um único azul para interação) e guarda **um só gesto de ousadia**: o número
do patrimônio em serifa editorial, apoiado na **linha de lastro**, uma régua em latão que mostra quanto
dos ativos está livre de dívidas (`components/finance/net-worth-hero.tsx`).

Por que não é um template: evitamos de propósito o creme com serifa e terracota, o preto com verde-ácido
e o layout de jornal. A serifa só aparece onde o assunto é patrimônio ou uma headline, lembrando o rigor
de um extrato impresso. Ela não é a voz da interface. O latão (brass) é **exclusivo do patrimônio** e
nunca aparece em botões nem em status.

## Princípios (Apple HIG aplicado à web)

| Princípio | Como aparece no Lastro |
| --- | --- |
| Clareza | Todo número vem com uma frase que diz o que ele significa (`takeaway`, `explainer`, `basis`) |
| Deferência | O conteúdo lidera. Cromo neutro e blur só na camada flutuante (header e tab bar) |
| Profundidade | Elevação por superfície (`surface` → `surface-raised`). No escuro vem da cor, não da sombra |
| Responsabilidade | Projeções levam o selo `Projeção` e um aviso. Nunca prometemos rentabilidade |
| Flexibilidade | Mobile tem navegação própria (tab bar + chips de seção). Não é o desktop encolhido |

## Cores por papel

Contraste WCAG medido sobre `canvas` (claro / escuro). Mínimo de 4,5:1 para texto.

| Token | Papel | Claro | Escuro | Contraste |
| --- | --- | --- | --- | --- |
| `canvas` | Fundo da aplicação | `#E2E7F1` | `#17181C` | — |
| `surface` | Cards e painéis | `#FFFFFF` | `#202329` | — |
| `surface-raised` | Modais, menus, popovers | `#FFFFFF` | `#282C34` | — |
| `surface-sunken` | Campos, trilhas, hover | `#EEF2F7` | `#121317` | — |
| `ink` | Texto principal | `#244C4E` | `#F2F2EF` | 7,6 / 15,8 |
| `ink-2` | Texto secundário | `#4C5267` | `#B7BCC3` | 6,3 / 9,3 |
| `ink-3` | Rótulos, metadados | `#5A6075` | `#9AA0A8` | 5,0 / 6,7 |
| `accent` | Links, foco, seleção | `#2D6E57` | `#8E9BFF` | 4,9 / 7,0 |
| `action` | Fundo do botão primário (CTA) | `#9EEA6C` | `#8E9BFF` | — |
| `brass` | **Exclusivo do patrimônio** | `#805F25` | `#D6B36E` | 4,7 / 8,9 |
| `positive` | Entradas, meta atingida | `#0A7350` | `#4FCB95` | 4,7 / 8,7 |
| `negative` | Excesso, erro, destrutivo | `#B3342D` | `#F2847B` | 4,9 / 7,1 |
| `warning` | Atenção (80% do orçamento) | `#8F5B00` | `#E6B04C` | 4,6 / 9,0 |

O tema claro usa a paleta branco + verde: lima `#9EEA6C` só como fundo de ação (nunca texto),
verde-escuro `#244C4E` como texto forte, cinza `#4C5267` no corpo.

O fundo escuro era quase preto puro (`#0A0B0D`); subimos a luminância dele e a de `ink-2`/`ink-3`
porque números e valores secundários (rótulos, legendas) ficavam camuflados nele — contraste
numérico já passava, mas o efeito perceptual em telas reais era de "cinza sobre preto ilegível".

Texto sobre o botão primário: `#244C4E` sobre `#9EEA6C` = 6,5:1 (hover `#8BDC56` = 5,6:1); `#0A0B0D` sobre `#8E9BFF` = 7,8:1.
Com `prefers-contrast: more`, `ink-2`, `ink-3` e `line` escurecem (ou clareiam no escuro).

**Regra:** uma cor, um significado. Despesa **não** é vermelha: gastar não é erro. Vermelho fica para
excesso de orçamento, atraso e ações destrutivas. Entradas usam `positive` **e** sinal `+`. Nada
depende só de cor.

### Paleta de gráficos (categórica, ordem fixa)

Escuro validado com o script do skill de dataviz (adjacentes: CVD ΔE ≥ 10,0; visão normal ≥ 16).
O claro usa os verdes da paleta + o caroço `#804B35` e uma tinta clara dele. Validado com CIEDE2000 e
simulação Machado 2009 (protan/deutan/tritan): ΔE00 ≥ 11,8 entre **quaisquer** dois slots, em todas as
visões; o trio brass + series-1 + series-2 da evolução patrimonial fica em ≥ 13,8.

| Slot | Claro | Escuro |
| --- | --- | --- |
| series-1 | `#337D63` (verde-contorno) | `#7584F5` |
| series-2 | `#6E983C` (polpa escurecida) | `#D2672F` |
| series-3 | `#58C411` (verde) | `#22A37E` |
| series-4 | `#244C4E` (verde-escuro) | `#B8860A` |
| series-5 | `#804B35` (caroço) | `#CC5F8F` |
| series-6 | `#CC9883` (caroço clareado) | `#9480EC` |

No claro, series-3 e 6 ficam abaixo de 3:1 sobre branco, por isso todo gráfico categórico traz
legenda com valores ou uma tabela. A cor segue a entidade, não a posição. A 7ª categoria vira "Outros".

## Tipografia

| Estilo | Fonte | Tamanho/linha | Uso |
| --- | --- | --- | --- |
| Display | Newsreader | 60–80 / 1 | Patrimônio, headlines da landing |
| Título 1 | Geist semibold | 32 / 38 | Título de página (desktop) |
| Título 2 | Geist semibold | 24 / 32 | Título de página (mobile), seções |
| Título 3 | Geist medium | 17 / 26 | Títulos de modal |
| Corpo | Geist | 15 / 24 | Texto padrão |
| Apoio | Geist | 14 / 20 | Descrições, células |
| Rótulo | Geist | 13 / 18 | Metadados, labels |
| Legenda | Geist | 12 / 16 | **Mínimo absoluto** |

Todo número financeiro usa `.num` (algarismos tabulares e alinhados). Unidades em `rem` respeitam o
zoom e o tamanho de fonte do navegador (200% sem quebra).

## Espaço, raio, elevação, movimento

- **Espaço:** base de 4px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80). Cards com 20–24px de padding. Página com 16 / 24 / 40px de gutter.
- **Raio concêntrico:** `xs 6` · `sm 8` · `md 12` (controles) · `lg 16` · `xl 22` (cards) · `2xl 28`.
- **Sombras** em camadas, com a cor da superfície (`--shadow-color`). No escuro quase não aparecem: a elevação vem de `surface-raised`.
- **Movimento:** 150–260ms, `cubic-bezier(.22,1,.36,1)`. Apenas `fade-in`, `rise` e `shimmer`. `prefers-reduced-motion` desliga tudo. Gráficos sem animação de entrada.
- **Breakpoints:** `xs 480` · `sm 640` · `md 768` (tab bar → rail) · `lg 1024` (rail → sidebar) · `xl 1280`. Conteúdo com no máximo 1280px.

## Componentes

| Categoria | Componentes | Arquivo |
| --- | --- | --- |
| Ações | `Button` (primary, secondary, subtle, ghost, danger, link; sm/md/lg/icon; `loading`), `IconButton` (rótulo obrigatório) | `ui/button.tsx` |
| Formulários | `Input` (leading/trailing), `Textarea`, `PasswordInput`, `Select`, `Switch`, `Field` (liga label, hint e erro por ARIA) | `ui/input.tsx`, `ui/field.tsx`, `ui/select.tsx` |
| Overlays | `Dialog`/`DialogContent`, `DrawerContent` (lateral no desktop, sheet inferior no mobile), `ConfirmDialog` (foco em Cancelar), `DropdownMenu`, `Tooltip`, `toast` | `ui/dialog.tsx`, `ui/dropdown-menu.tsx` |
| Dados | `Table`/`TR`/`TH`/`TD`, `ListRow` (mobile), `Progress` + `budgetTone` (50/80/100%), `Badge`, `Skeleton` | `ui/table.tsx`, `ui/progress.tsx`, `ui/primitives.tsx` |
| Navegação | `Sidebar`, `MobileTabBar`, `SectionSwitcher`, `AppHeader`, `CommandMenu` (⌘K), `Breadcrumbs`, `Tabs` (segmentado), `PageHeader` | `layout/*`, `ui/tabs.tsx` |
| Estados | `EmptyState` (educativo, com ação), `ErrorState` (com "Tentar novamente"), `loading.tsx` por rota | `ui/states.tsx` |
| Finanças | `Amount` (sinal + cor + texto para leitor de tela; modo privacidade), `Delta` (ícone + sinal + cor), `StatTile` (com `explainer`), `NetWorthHero`, `Insight` (com `basis`), `EstimateBadge`/`EstimateDisclaimer` | `finance/*` |
| Gráficos | `ChartCard` (takeaway, legenda, alternância com tabela), `AreaChart`, `BarChart`, `LineChart` (projeções tracejadas), `DonutChart`, `Sparkline` | `charts/*` |

### Regras de gráfico

1. Um eixo Y por gráfico. Área e barra partem do zero; linhas podem usar domínio automático.
2. Linhas de 2px, barras de até 16px com topo arredondado em 4px, grade horizontal recessiva.
3. Todo gráfico tem título, **uma frase de conclusão**, tooltip, `aria-label` e alternância para tabela.
4. Projeções são sempre tracejadas e levam `EstimateBadge`.

## Navegação

| Largura | Padrão |
| --- | --- |
| < 768px | Tab bar inferior com 5 destinos (Início, Lançamentos, Planejar, Patrimônio, Relatórios) e chips para as telas irmãs. Busca e perfil ficam no header |
| 768–1023px | Rail de ícones com tooltip |
| ≥ 1024px | Sidebar completa e recolhível, em até 2 níveis (grupo → tela) |

Abas navegam, não executam ações. A ação "novo lançamento" fica no header/⌘K e, na Fase 4, num
botão flutuante no mobile.

## Acessibilidade (piso de qualidade)

- Contraste ≥ 4,5:1 em todo texto, nos dois temas. Foco visível (`2px accent`, offset 2px).
- Alvos ≥ 40px no desktop e ≥ 44px nos itens da tab bar (58px de altura).
- Link "Pular para o conteúdo", `aria-current` na navegação, `role="progressbar"` com `aria-valuetext`.
- Valores lidos com contexto ("Entrada de R$ 14.200,00"). Nada é comunicado só por cor.
- Tema padrão = **sistema**. A escolha manual (Claro/Escuro) existe porque o briefing pede, mas o
  HIG desaconselha forçar aparência própria do app (`dark-mode.md › Best practices`). Por isso o
  padrão continua sendo o do sistema.
