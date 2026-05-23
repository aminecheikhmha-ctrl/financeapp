"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

// ─── Types ─────────────────────────────────────────────────────────────────────
type Category = "technique" | "fondamentale" | "crypto" | "forex" | "options" | "macro"
type Level    = "débutant" | "intermédiaire" | "avancé"

interface GlossaryTerm {
  term: string
  category: Category
  level: Level
  short: string
  definition: string
  example: string
  course_link?: string
}

// ─── Glossary data ─────────────────────────────────────────────────────────────
const GLOSSARY: GlossaryTerm[] = [
  // A
  { term: "Action", category: "fondamentale", level: "débutant", short: "Part de propriété d'une entreprise cotée en bourse", definition: "Une action représente une fraction du capital social d'une société. Détenir une action signifie être actionnaire — co-propriétaire de l'entreprise à hauteur de ta part.", example: "1 action AAPL à $180 = tu possèdes ~0.000006% d'Apple. Sur 15 milliards d'actions en circulation.", course_link: "introduction-marches" },
  { term: "Alpha", category: "fondamentale", level: "intermédiaire", short: "Surperformance d'un fonds vs son indice de référence", definition: "L'alpha mesure la performance d'un investissement par rapport à l'indice de référence (benchmark). Un alpha positif signifie que le gérant a battu le marché.", example: "Fonds actions US avec alpha = +3% : si le S&P fait +10%, ce fonds fait +13%. Trouver de l'alpha réel est extrêmement difficile.", course_link: "analyse-fondamentale" },
  { term: "Ask", category: "technique", level: "débutant", short: "Prix minimum auquel un vendeur accepte de vendre", definition: "Le prix Ask (ou Offer) est le prix minimum qu'un vendeur est prêt à accepter. Le spread bid-ask est la différence entre le meilleur bid et le meilleur ask.", example: "AAPL : Bid $179.95 / Ask $180.05. Spread = $0.10. Sur actions liquides, ce spread est minimal.", course_link: "bases-trading" },
  { term: "ATH", category: "technique", level: "débutant", short: "All-Time High — plus haut historique d'un actif", definition: "L'ATH est le prix le plus élevé jamais atteint par un actif depuis sa création/introduction en bourse. Casser l'ATH est souvent un signal technique haussier fort.", example: "Bitcoin ATH : $73,750 en mars 2024. S&P 500 ATH : 5,264 en mars 2024. Un asset qui casse son ATH entre en 'price discovery'.", course_link: "analyse-technique" },
  // B
  { term: "Backtest", category: "technique", level: "intermédiaire", short: "Test d'une stratégie sur données historiques passées", definition: "Le backtesting consiste à simuler l'application d'une stratégie de trading sur des données historiques pour évaluer sa performance passée. Attention aux biais (overfitting, survivorship).", example: "Stratégie RSI < 30 = achat, backtestée sur SPY 2000-2024 : +1,200% vs +350% buy&hold. Mais performance passée ≠ garantie future.", course_link: "machine-learning-trading" },
  { term: "Bear Market", category: "fondamentale", level: "débutant", short: "Marché baissier — baisse de 20%+ depuis le dernier sommet", definition: "Un bear market est officiellement une baisse de 20% ou plus depuis le sommet récent. Psychologiquement, il correspond à une période de pessimisme généralisé.", example: "S&P 500 2022 : -27% du sommet. 2008-2009 : -57%. COVID mars 2020 : -34% en 33 jours (le plus rapide de l'histoire).", course_link: "introduction-marches" },
  { term: "Beta", category: "fondamentale", level: "intermédiaire", short: "Sensibilité d'un actif aux mouvements du marché", definition: "Le beta mesure la volatilité relative d'un actif par rapport au marché (beta = 1). Beta > 1 = plus volatil que le marché. Beta < 0 = inverse au marché.", example: "Tesla beta = 2.0 : si S&P +10%, Tesla attend +20%. Or beta = -0.1 : légèrement inverse au marché. Bonds beta ~ 0.", course_link: "portfolio-construction" },
  { term: "Bid", category: "technique", level: "débutant", short: "Prix maximum qu'un acheteur est prêt à payer", definition: "Le Bid est le prix maximum que les acheteurs sont prêts à payer pour un actif. C'est le prix auquel tu vendras si tu passes un ordre market.", example: "AAPL : Bid $179.95. Si tu vends AAPL au marché, tu recevras $179.95 (le meilleur bid).", course_link: "bases-trading" },
  { term: "Bollinger Bands", category: "technique", level: "intermédiaire", short: "Bandes de volatilité autour d'une moyenne mobile", definition: "Les Bollinger Bands sont composées d'une MA20 centrale et de deux bandes à ±2 écarts-types. Elles mesurent la volatilité et identifient les zones de surachat/survente relatives.", example: "AAPL touche la bande basse de Bollinger à $170 avec RSI 28 → signal de survente potentiel. Prix hors bande = anomalie statistique.", course_link: "analyse-technique" },
  { term: "Breakout", category: "technique", level: "débutant", short: "Cassure d'un niveau de résistance ou de support clé", definition: "Un breakout se produit quand le prix casse un niveau technique important (résistance, plus haut, consolidation) avec du volume. C'est souvent le déclencheur d'un nouveau mouvement directionnel.", example: "NVDA consolide 4 semaines entre $450-$480. Breakout à $481 avec volume 3x → swing traders entrent long. TP à $520.", course_link: "swing-trading" },
  { term: "Bull Market", category: "fondamentale", level: "débutant", short: "Marché haussier — hausse de 20%+ depuis le dernier creux", definition: "Un bull market est une période prolongée de hausse des marchés, généralement définie par une hausse de 20%+ depuis le dernier creux. Associé à l'optimisme économique.", example: "Le bull market US 2009-2020 : +400% sur 11 ans. Le plus long de l'histoire. Bitcoin 2020-2021 : +1,500%.", course_link: "introduction-marches" },
  // C
  { term: "Call", category: "options", level: "intermédiaire", short: "Option d'achat — droit d'acheter un actif à un prix fixé", definition: "Un call est une option qui donne le droit (pas l'obligation) d'acheter l'actif sous-jacent au prix d'exercice (strike) avant ou à l'expiration. Profitable si l'actif monte.", example: "Call AAPL $190 exp. juin : tu paies $5 prime. Si AAPL monte à $210, tu peux l'acheter à $190 → profit $15 (gain de 200% sur la prime).", course_link: "options-derives" },
  { term: "Candlestick", category: "technique", level: "débutant", short: "Bougie japonaise — représentation OHLC sur un graphe", definition: "Un chandelier japonais représente les 4 prix clés d'une période : Open (ouverture), High (plus haut), Low (plus bas), Close (clôture). Le corps montre la direction, les mèches l'amplitude.", example: "Bougie verte = clôture > ouverture (haussier). Rouge = clôture < ouverture (baissier). Doji = O≈C (indécision).", course_link: "analyse-technique" },
  { term: "Carry Trade", category: "forex", level: "avancé", short: "Emprunter dans une devise à faible taux pour investir à taux élevé", definition: "Le carry trade consiste à emprunter dans une devise avec un faible taux d'intérêt et investir dans une devise avec un taux plus élevé, profitant du différentiel.", example: "2023 : emprunter en JPY (0%) → investir en USD (5.25%). Profit = 5.25% - coût emprunt. Risk = appréciation du JPY qui efface le gain.", course_link: "forex-debutant" },
  { term: "CAC 40", category: "fondamentale", level: "débutant", short: "Indice des 40 plus grandes entreprises françaises", definition: "Le CAC 40 est l'indice boursier de référence en France, composé des 40 plus grandes capitalisations boursières de la place de Paris (Euronext).", example: "CAC 40 au 1er janvier 2000 : 5,926. Pic 2007 : 6,168. Covid crash : 3,754. Niveau 2024 : ~8,000. Dominé par LVMH, TotalEnergies, Hermès.", course_link: "indices-mondiaux" },
  // D
  { term: "Day Trading", category: "technique", level: "intermédiaire", short: "Ouverture et fermeture de positions dans la même journée", definition: "Le day trading consiste à ouvrir et fermer toutes ses positions dans la même journée de trading, sans position overnight. Requiert vitesse, discipline et connaissance des marchés intraday.", example: "9h35 : achat 100 AAPL à $180. 10h15 : vente à $182.50. Profit : $250 brut. Minus commissions et impôts. 90% des day traders perdent.", course_link: "day-trading" },
  { term: "Delta", category: "options", level: "avancé", short: "Sensibilité du prix d'une option au prix du sous-jacent", definition: "Le delta mesure la variation du prix d'une option pour une variation de $1 du sous-jacent. Delta = 0.50 (ATM call) : l'option gagne $0.50 si l'action monte de $1.", example: "Call AAPL $180 delta 0.60 : si AAPL monte de $5, le call gagne ~$3.00. Delta augmente quand l'option devient ITM.", course_link: "options-derives" },
  { term: "Divergence RSI", category: "technique", level: "intermédiaire", short: "Signal quand le prix et le RSI vont dans des directions opposées", definition: "Une divergence RSI baissière se produit quand le prix fait un nouveau plus haut mais le RSI fait un plus haut plus bas. Signal de retournement potentiel. La divergence haussière est l'inverse.", example: "AAPL fait un plus haut à $195 (vs $190 précédent) mais RSI passe de 72 à 65 → divergence baissière. AAPL corrige de -12% dans les 3 semaines.", course_link: "analyse-technique" },
  { term: "DCA", category: "fondamentale", level: "débutant", short: "Dollar Cost Averaging — investissement régulier en montant fixe", definition: "Le DCA consiste à investir un montant fixe à intervalles réguliers (ex: $500/mois dans SPY) indépendamment du prix. Réduit l'impact de l'achat au mauvais moment.", example: "$500/mois dans SPY depuis janvier 2020 → investissement total $28,000 → valeur fin 2024 ~$45,000. Le DCA a traversé le crash COVID sans panique.", course_link: "investissement-passif" },
  // E
  { term: "EMA", category: "technique", level: "débutant", short: "Exponential Moving Average — moyenne mobile exponentielle", definition: "L'EMA est une moyenne mobile qui donne plus de poids aux prix récents. Réagit plus vite aux changements de prix que la SMA. EMA9 et EMA21 sont les plus utilisées.", example: "AAPL EMA21 daily : si le prix est au-dessus et rebondit = signal achat. EMA9 croise EMA21 à la hausse = golden cross court terme.", course_link: "analyse-technique" },
  { term: "ETF", category: "fondamentale", level: "débutant", short: "Exchange-Traded Fund — fonds indiciel coté en bourse", definition: "Un ETF est un fonds qui réplique un indice (S&P 500, CAC 40, or...) et se négocie en bourse comme une action. Frais très bas, diversification instantanée.", example: "SPY : ETF S&P 500, TER 0.09%. 1 part = $500 environ. Acheter 1 SPY = exposé aux 500 plus grandes US. VOO (Vanguard) : TER 0.03%.", course_link: "investissement-passif" },
  { term: "EUR/USD", category: "forex", level: "débutant", short: "Paire de devises Euro vs Dollar américain", definition: "EUR/USD est la paire Forex la plus tradée au monde (~24% du volume global). Représente combien de dollars vaut 1 euro.", example: "EUR/USD à 1.0850 : 1 euro vaut 1.0850 dollars. Pip = 0.0001. Sur 1 lot standard (100,000€), 1 pip = $10.", course_link: "forex-debutant" },
  // F
  { term: "Fibonacci", category: "technique", level: "intermédiaire", short: "Niveaux de retracement basés sur la suite de Fibonacci", definition: "Les retracements Fibonacci utilisent les ratios 23.6%, 38.2%, 50%, 61.8%, 78.6% pour identifier des zones de support/résistance potentielles après un mouvement.", example: "SPY monte de $400 à $500 (+$100). Retracement 61.8% = $438 ($100 × 0.618 = $61.8 de retrait). Zone clé pour un rebond potentiel.", course_link: "swing-trading" },
  { term: "Flat Tax", category: "fondamentale", level: "débutant", short: "Impôt forfaitaire de 30% sur les plus-values mobilières en France", definition: "La flat tax (PFU - Prélèvement Forfaitaire Unique) est un taux d'imposition unique de 30% (12.8% IR + 17.2% PS) sur les revenus du capital en France depuis 2018.", example: "Plus-value de $10,000 → flat tax = $3,000. Option IR possible si TMI < 11% pour économiser (TMI 11% + 17.2% PS = 28.2% < 30%).", course_link: "fiscalite-trading" },
  // G
  { term: "Gap", category: "technique", level: "intermédiaire", short: "Discontinuité du prix entre la clôture et l'ouverture suivante", definition: "Un gap est un espace sur le graphe où aucun trade n'a eu lieu. Gap up = ouverture au-dessus de la clôture précédente. Gap down = ouverture en dessous. Les gaps ont tendance à se combler.", example: "NVDA ferme à $450. Résultats exceptionnels → ouverture à $480. Gap up de +6.7%. Volume 5x la normale → setup 'gap and go' pour day traders.", course_link: "day-trading" },
  { term: "Greeks", category: "options", level: "avancé", short: "Mesures de sensibilité des options (Delta, Gamma, Theta, Vega)", definition: "Les Greeks mesurent les différentes sensibilités d'une option à divers paramètres : prix du sous-jacent (delta), vitesse de variation du delta (gamma), temps (theta), volatilité (vega).", example: "Call AAPL : delta 0.55, gamma 0.02, theta -$5/jour, vega +$8 par point de vol. Ton option perd $5/jour juste avec le temps qui passe.", course_link: "derivatives-strategies" },
  // H
  { term: "Halving", category: "crypto", level: "intermédiaire", short: "Réduction de moitié de la récompense des mineurs Bitcoin", definition: "Le halving Bitcoin se produit tous les 210,000 blocs (~4 ans). La récompense des mineurs est divisée par 2, réduisant l'émission de nouveaux BTC et créant une pression haussière historique.", example: "Halving avril 2024 : récompense 6.25 → 3.125 BTC/bloc. Halvings précédents (2012, 2016, 2020) ont tous précédé un bull market majeur.", course_link: "crypto-avance" },
  { term: "Hedge", category: "fondamentale", level: "intermédiaire", short: "Position qui réduit le risque d'une autre position existante", definition: "Hedger = prendre une position qui va à l'encontre d'une exposition existante pour réduire le risque. C'est une assurance contre un mouvement défavorable.", example: "Tu détiens 100 actions AAPL. Tu achètes des puts AAPL → si AAPL chute, les puts gagnent de la valeur et compensent partiellement la perte.", course_link: "options-derives" },
  // I
  { term: "Implied Volatility", category: "options", level: "avancé", short: "Volatilité future anticipée par le marché des options", definition: "L'IV (volatilité implicite) est la volatilité future que le marché anticipe, extraite du prix des options. Elle monte en période d'incertitude et baisse en marchés calmes.", example: "IV AAPL avant résultats : 45%. Après : 25%. Ce 'vol crush' est systématique — les vendeurs d'options l'exploitent régulièrement.", course_link: "volatility-trading" },
  { term: "Iron Condor", category: "options", level: "avancé", short: "Stratégie d'options qui profite d'un marché en range", definition: "L'iron condor combine un bull put spread + bear call spread. Max profit si l'actif reste entre les deux short strikes à expiration. Stratégie idéale en faible volatilité.", example: "Iron condor SPX : vendre put 5000 + acheter put 4950 + vendre call 5400 + acheter call 5450. Prime $3. Max profit si SPX entre 5000-5400.", course_link: "derivatives-strategies" },
  // L
  { term: "Levier", category: "fondamentale", level: "débutant", short: "Multiplier son exposition avec moins de capital", definition: "Le levier (ou effet de levier) permet de contrôler une position plus grande que son capital. Un levier 1:10 signifie qu'avec $1,000 tu contrôles $10,000.", example: "Forex EU levier max 1:30. Avec $1,000 → $30,000 de position. Si EUR/USD monte de 1% → +$300 (+30% du capital). Si -1% → -$300 (-30%). Arme à double tranchant.", course_link: "forex-debutant" },
  { term: "Liquidité", category: "fondamentale", level: "débutant", short: "Facilité avec laquelle un actif peut être acheté ou vendu", definition: "La liquidité mesure la facilité à acheter/vendre un actif sans affecter significativement son prix. Un actif liquide a un spread étroit et un grand volume.", example: "AAPL : 60M actions/jour. Spread 0.01%. Très liquide. Action small cap : 10,000 actions/jour. Spread 2%. Vendre en urgence → forte impact prix.", course_link: "introduction-marches" },
  { term: "Lot", category: "forex", level: "débutant", short: "Unité standard de trading Forex (100,000 unités)", definition: "Un lot standard = 100,000 unités de la devise de base. Un mini-lot = 10,000. Un micro-lot = 1,000. La taille de lot détermine la valeur du pip.", example: "1 lot EUR/USD = 100,000€. 1 pip = $10. Si EUR/USD monte de 50 pips → +$500. Mini-lot : 1 pip = $1.", course_link: "forex-debutant" },
  // M
  { term: "MACD", category: "technique", level: "intermédiaire", short: "Moving Average Convergence Divergence — indicateur de tendance/momentum", definition: "Le MACD = EMA12 - EMA26. La ligne signal = EMA9 du MACD. Le croisement MACD/signal est un signal de trading. L'histogramme montre la force du momentum.", example: "AAPL MACD croise au-dessus de la ligne signal avec histogramme positif croissant → signal achat. Confirmé si au-dessus de la ligne zéro.", course_link: "analyse-technique" },
  { term: "Margin Call", category: "fondamentale", level: "intermédiaire", short: "Appel de marge — obligation d'ajouter des fonds ou fermer des positions", definition: "Un margin call survient quand la valeur de ton compte tombe sous le niveau de marge requis. Le broker te demande d'ajouter des fonds ou ferme automatiquement tes positions.", example: "Tu achètes $50,000 d'actions avec $25,000 cash + $25,000 marge. Si la valeur chute à $35,000 → tu as perdu $15,000 de marge → margin call.", course_link: "gestion-risque" },
  { term: "Market Cap", category: "fondamentale", level: "débutant", short: "Valeur boursière totale d'une entreprise", definition: "La market cap = prix de l'action × nombre d'actions en circulation. C'est la valeur totale que le marché attribue à l'entreprise.", example: "Apple fin 2024 : ~$3,500 milliards de market cap. 15 milliards d'actions × $230 ≈ $3,450 Mds. Plus grande market cap de l'histoire.", course_link: "analyse-fondamentale" },
  { term: "Market Maker", category: "fondamentale", level: "intermédiaire", short: "Acteur qui fournit de la liquidité en affichant constamment bid et ask", definition: "Un market maker est un intermédiaire qui garantit la liquidité en affichant en permanence des prix d'achat (bid) et de vente (ask). Il profite du spread et assume le risque d'inventaire.", example: "Citadel Securities, Virtu Financial : market makers sur actions US. Ils exécutent 30%+ du volume retail US. Gagnent $0.001-$0.01 par action sur le spread.", course_link: "market-making" },
  { term: "Momentum", category: "technique", level: "intermédiaire", short: "Tendance d'un actif à continuer dans sa direction actuelle", definition: "Le momentum est la tendance des actifs qui ont performé récemment à continuer de surperformer (et vice versa). C'est l'un des facteurs les plus robustes empiriquement.", example: "Stratégie momentum : acheter les 20% meilleures actions des 12 derniers mois, vendre les 20% pires. Sharpe historique 0.5-0.7 sur 100 ans de données.", course_link: "statistical-arbitrage" },
  { term: "MVRV", category: "crypto", level: "avancé", short: "Market Value to Realized Value — indicateur on-chain pour Bitcoin", definition: "MVRV = Market Cap / Realized Cap. La realized cap est la valeur de tous les BTC au prix de leur dernier mouvement. MVRV > 3.5 = zone de top historique. < 1 = zone d'accumulation.", example: "MVRV Bitcoin décembre 2017 : 3.98 → top à $20k. Novembre 2021 : 3.96 → top à $69k. 2022 bear market fond : MVRV < 1.", course_link: "crypto-avance" },
  // O
  { term: "On-chain Analysis", category: "crypto", level: "avancé", short: "Analyse des données directement visibles sur la blockchain", definition: "L'analyse on-chain consiste à étudier les données de la blockchain (mouvements de wallets, flux exchange, MVRV, NVT...) pour évaluer l'état du marché crypto.", example: "Exchange netflows BTC : si les baleines transfèrent massivement vers les exchanges → pression vendeuse. Si les BTC quittent les exchanges → accumulation.", course_link: "crypto-avance" },
  { term: "Ordre Limit", category: "technique", level: "débutant", short: "Ordre d'achat ou vente à un prix précis ou meilleur", definition: "Un ordre limit s'exécute uniquement au prix spécifié ou à un meilleur prix. Garantit le prix mais pas l'exécution (si le prix n'est pas atteint, l'ordre ne s'exécute pas).", example: "AAPL à $182. Tu places un limit buy à $178 (support). Si AAPL descend à $178 → ordre exécuté. Si AAPL rebondit sans toucher $178 → ordre non exécuté.", course_link: "bases-trading" },
  { term: "Ordre Market", category: "technique", level: "débutant", short: "Ordre exécuté immédiatement au meilleur prix disponible", definition: "Un ordre market s'exécute immédiatement au meilleur prix disponible. Garantit l'exécution mais pas le prix (slippage possible sur actifs peu liquides).", example: "AAPL bid $179.95 / ask $180.05. Ordre market achat → exécuté à $180.05 (l'ask). Ordre market vente → $179.95 (le bid).", course_link: "bases-trading" },
  // P
  { term: "PEA", category: "fondamentale", level: "débutant", short: "Plan d'Épargne en Actions — enveloppe fiscale française avantageuse", definition: "Le PEA est une enveloppe fiscale française permettant d'investir dans des actions européennes avec une exonération d'IR après 5 ans (17.2% PS seulement). Plafonné à 150,000€.", example: "PEA ouvert en 2019 avec $50,000 → gain de $80,000 en 2024. Retrait : seulement 17.2% × $80,000 = $13,760 d'impôts. Vs CTO flat tax : $24,000.", course_link: "fiscalite-trading" },
  { term: "Pip", category: "forex", level: "débutant", short: "Plus petite variation de prix standardisée sur une paire Forex", definition: "Un pip (Percentage In Point) est la plus petite variation de prix standard sur le Forex. Sur la plupart des paires : 0.0001. Sur USD/JPY : 0.01.", example: "EUR/USD passe de 1.0850 à 1.0860 → +10 pips. Sur 1 lot standard → +$100 (10 pips × $10/pip).", course_link: "forex-debutant" },
  { term: "Put", category: "options", level: "intermédiaire", short: "Option de vente — droit de vendre un actif à un prix fixé", definition: "Un put donne le droit (pas l'obligation) de vendre l'actif sous-jacent au prix d'exercice. Profitable si l'actif baisse. Utilisé pour protéger un portefeuille (hedging).", example: "Put AAPL $170 exp. juin : paie $3. Si AAPL chute à $150 → tu peux vendre à $170 → gain $17 par action (467% sur la prime).", course_link: "options-derives" },
  // R
  { term: "R/R", category: "technique", level: "débutant", short: "Ratio Risk/Reward — rapport entre gain potentiel et perte maximale", definition: "Le ratio Risk/Reward mesure le rapport entre le gain potentiel et la perte maximale d'un trade. Un R/R de 2:1 signifie que tu peux gagner 2x ce que tu risques.", example: "Trade AAPL : entry $180, stop-loss $174 (risque $6), TP $195 (gain $15). R/R = 15/6 = 2.5:1. En ne gagnant que 50% de tes trades, tu es profitable.", course_link: "gestion-risque" },
  { term: "Résistance", category: "technique", level: "débutant", short: "Niveau de prix où l'offre dépasse la demande — frein à la hausse", definition: "Une résistance est un niveau de prix où le selling pressure historiquement dépasse le buying pressure, empêchant le prix de monter plus haut. Quand une résistance est cassée, elle devient support.", example: "AAPL a testé $195 à 3 reprises sans passer. $195 est une résistance forte. Quand AAPL casse $195 avec volume → $195 devient support.", course_link: "analyse-technique" },
  { term: "RSI", category: "technique", level: "débutant", short: "Relative Strength Index — oscillateur de momentum entre 0 et 100", definition: "Le RSI mesure la vitesse et l'amplitude des variations de prix. RSI > 70 = surachat (potentiel de correction). RSI < 30 = survente (potentiel de rebond).", example: "RSI AAPL à 27 en janvier 2024 → zone de survente → signal d'achat potentiel. L'action a rebondi de +18% dans les 3 semaines suivantes.", course_link: "analyse-technique" },
  // S
  { term: "Scalping", category: "technique", level: "avancé", short: "Trading très court terme — dizaines à centaines de trades par jour", definition: "Le scalping consiste à prendre de nombreuses petites positions de courte durée (secondes à minutes) pour capturer de micro-mouvements. Requiert des spreads très serrés et une exécution ultra-rapide.", example: "Scalper sur EUR/USD : 50 trades/jour, objectif 2-5 pips/trade. Sur 1 mini-lot, 3 pips = $3. × 50 trades = $150/jour si tout va bien.", course_link: "day-trading" },
  { term: "Sharpe Ratio", category: "fondamentale", level: "intermédiaire", short: "Rendement ajusté au risque d'un portefeuille", definition: "Le Sharpe ratio = (rendement - taux sans risque) / écart-type. Mesure la performance par unité de risque. Sharpe > 1 = bon. > 2 = excellent. > 3 = exceptionnel.", example: "S&P 500 : Sharpe ~0.5. Bridgewater All Weather : ~0.8. Renaissance Medallion (secret) : ~3+. Un Sharpe > 1.5 est difficile à maintenir long terme.", course_link: "portfolio-construction" },
  { term: "Short Selling", category: "technique", level: "intermédiaire", short: "Vendre à découvert — parier sur la baisse d'un actif", definition: "Le short selling consiste à emprunter des actions, les vendre, et espérer les racheter plus bas. Profit = prix de vente - prix de rachat. Risque théoriquement illimité.", example: "Tu shortes NVDA à $500 (empruntes 100 actions, les vends). NVDA chute à $420 → rachètes → profit = $8,000. Si NVDA monte à $600 → perte $10,000.", course_link: "analyse-technique" },
  { term: "Spread", category: "technique", level: "débutant", short: "Différence entre le prix d'achat (ask) et de vente (bid)", definition: "Le spread est la différence entre le prix ask (vendeur) et le bid (acheteur). C'est le coût implicite d'un trade et la rémunération du market maker.", example: "EUR/USD spread : bid 1.0850 / ask 1.0851 → spread = 0.1 pip = $1 sur mini-lot. Actions AAPL : spread $0.01. Actions illiquides : spread $0.50+.", course_link: "bases-trading" },
  { term: "Stop-Loss", category: "technique", level: "débutant", short: "Ordre automatique qui clôture une position en perte à un niveau prédéfini", definition: "Le stop-loss est un ordre qui déclenche automatiquement la vente (ou rachat) d'une position quand le prix atteint un niveau prédéfini, limitant la perte maximale.", example: "Achat AAPL à $180 avec stop-loss à $172. Si AAPL chute à $172 → vente automatique → perte limitée à $8/action (-4.4%). Sans stop-loss, AAPL pourrait chuter à $100.", course_link: "bases-trading" },
  { term: "Support", category: "technique", level: "débutant", short: "Niveau de prix où la demande dépasse l'offre — rebond potentiel", definition: "Un support est un niveau de prix où l'acheteur pressure historiquement dépasse le selling pressure, empêchant le prix de descendre plus bas. Quand un support est cassé, il devient résistance.", example: "AAPL a rebondi 4 fois sur $170 en 2024. $170 est un support fort. Si AAPL casse $170 avec volume → $170 devient résistance.", course_link: "analyse-technique" },
  // T
  { term: "TER", category: "fondamentale", level: "débutant", short: "Total Expense Ratio — frais annuels totaux d'un ETF ou fonds", definition: "Le TER est le pourcentage des frais annuels prélevés sur la valeur d'un fonds. Sur un ETF, inclut les frais de gestion, administratifs et opérationnels.", example: "SPY TER : 0.09%/an. Sur $10,000 → $9/an de frais. Fonds actif moyen : 1.5%/an → $150. Différence sur 30 ans = -$35,000 de rendement net.", course_link: "investissement-passif" },
  { term: "Theta", category: "options", level: "avancé", short: "Déclin de la valeur d'une option avec le temps (time decay)", definition: "Theta mesure combien une option perd de valeur chaque jour simplement par l'écoulement du temps. Les vendeurs d'options veulent un theta élevé (ils encaissent ce déclin).", example: "Call AAPL theta = -$8/jour. Si tout reste stable, l'option perd $8 de valeur chaque jour. Sur 30 jours → -$240 juste avec le temps.", course_link: "derivatives-strategies" },
  { term: "Trend Line", category: "technique", level: "débutant", short: "Ligne tracée connectant les plus hauts ou plus bas successifs", definition: "Une trend line est tracée en connectant au moins 2 points (plus hauts en downtrend, plus bas en uptrend). La 3ème touche valide la ligne. Un break de trend line est un signal fort.", example: "NVDA en uptrend : trend line connecte $250 (oct), $310 (déc), $380 (fév). 4ème touche à $420 = signal achat. Break sous $380 = alerte baissière.", course_link: "swing-trading" },
  // V
  { term: "VIX", category: "technique", level: "intermédiaire", short: "Indice de volatilité implicite du S&P 500 — 'l'indice de la peur'", definition: "Le VIX mesure la volatilité implicite à 30 jours des options sur S&P 500. VIX élevé = peur/incertitude. VIX bas = complaisance. VIX > 40 = panique extrême.", example: "Mars 2020 : VIX = 82 (record de crise). Période calme 2021 : VIX = 12-15. Règle : VIX > 30 = potentiel opportunité d'achat. VIX < 12 = méfiance.", course_link: "volatility-trading" },
  { term: "VWAP", category: "technique", level: "intermédiaire", short: "Volume-Weighted Average Price — prix moyen pondéré par volume", definition: "Le VWAP est le prix moyen d'un actif pondéré par le volume depuis l'ouverture. Les institutionnels l'utilisent comme benchmark d'exécution. Prix au-dessus = tendance haussière intraday.", example: "AAPL VWAP à 11h = $182. Prix actuel $184 → au-dessus du VWAP → acheteurs dominants → day traders préfèrent les longs.", course_link: "day-trading" },
  // W
  { term: "Whale", category: "crypto", level: "intermédiaire", short: "Grand détenteur de crypto capable de déplacer les prix", definition: "Une 'baleine' est un acteur (individu ou institution) détenant suffisamment d'un actif crypto pour influencer son prix par ses transactions.", example: "Une baleine BTC déplace 10,000 BTC vers un exchange → signal de vente potentiel → petits traders réagissent → prix chute. On-chain analysis permet de les suivre.", course_link: "crypto-avance" },
  // Z
  { term: "Z-Score", category: "technique", level: "avancé", short: "Mesure statistique du nombre d'écarts-types d'une valeur vs sa moyenne", definition: "Le Z-score = (valeur - moyenne) / écart-type. En pairs trading, un Z-score > 2 sur un spread = opportunité (spread anormalement écarté, retour à la moyenne attendu).", example: "MSFT/GOOGL ratio Z-score = 2.3 → le spread est 2.3 sigmas au-dessus de sa moyenne historique → vendre MSFT, acheter GOOGL → retour à la moyenne attendu.", course_link: "statistical-arbitrage" },
]

const CATEGORIES: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all",          label: "Tous",          emoji: "📚" },
  { key: "technique",    label: "Technique",     emoji: "📊" },
  { key: "fondamentale", label: "Fondamentale",  emoji: "🏢" },
  { key: "crypto",       label: "Crypto",        emoji: "🔗" },
  { key: "forex",        label: "Forex",         emoji: "💱" },
  { key: "options",      label: "Options",       emoji: "🎯" },
  { key: "macro",        label: "Macro",         emoji: "🌏" },
]

const LEVEL_COLORS = {
  débutant:      { bg: "rgba(74,222,128,0.1)",  text: "#4ade80", border: "rgba(74,222,128,0.25)"  },
  intermédiaire: { bg: "rgba(96,165,250,0.1)",  text: "#60a5fa", border: "rgba(96,165,250,0.25)"  },
  avancé:        { bg: "rgba(167,139,250,0.1)", text: "#a78bfa", border: "rgba(167,139,250,0.25)" },
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

// ─── Term Card ─────────────────────────────────────────────────────────────────
function TermCard({ term, index, onClick }: { term: GlossaryTerm; index: number; onClick: () => void }) {
  const lc = LEVEL_COLORS[term.level]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer transition-all"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-white font-black text-sm">{term.term}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
            {term.level.charAt(0).toUpperCase()}
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "#555", border: "1px solid rgba(255,255,255,0.08)" }}>
            {CATEGORIES.find(c => c.key === term.category)?.emoji}
          </span>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: "#666" }}>{term.short}</p>
    </motion.div>
  )
}

// ─── Term Modal ────────────────────────────────────────────────────────────────
function TermModal({ term, onClose, onNavigate }: { term: GlossaryTerm; onClose: () => void; onNavigate: (id: string) => void }) {
  const lc = LEVEL_COLORS[term.level]
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="max-w-lg w-full rounded-3xl overflow-hidden"
        style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: "#111" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#444" }}>
                {CATEGORIES.find(c => c.key === term.category)?.emoji} {CATEGORIES.find(c => c.key === term.category)?.label}
              </p>
              <h2 className="text-2xl font-black text-white">{term.term}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black px-2.5 py-1 rounded-full"
                style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
                {term.level}
              </span>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white/60"
                style={{ background: "rgba(255,255,255,0.04)" }}>✕</button>
            </div>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#888" }}>{term.short}</p>
        </div>
        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#444" }}>Définition</p>
            <p className="text-sm leading-relaxed" style={{ color: "#bbb" }}>{term.definition}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)" }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#60a5fa" }}>💡 Exemple concret</p>
            <p className="text-sm leading-relaxed" style={{ color: "#aaa" }}>{term.example}</p>
          </div>
          {term.course_link && (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(term.course_link!)}
              className="w-full py-3 rounded-xl text-sm font-black transition-all"
              style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
              📚 Apprendre dans le cours →
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function GlossairePage() {
  const router = useRouter()
  const [search,   setSearch]   = useState("")
  const [category, setCategory] = useState<Category | "all">("all")
  const [level,    setLevel]    = useState<Level | "all">("all")
  const [letter,   setLetter]   = useState<string | null>(null)
  const [selected, setSelected] = useState<GlossaryTerm | null>(null)

  const filtered = useMemo(() => {
    return GLOSSARY.filter(t => {
      if (category !== "all" && t.category !== category) return false
      if (level    !== "all" && t.level    !== level)    return false
      if (letter   && !t.term.toUpperCase().startsWith(letter))    return false
      if (search) {
        const q = search.toLowerCase()
        return t.term.toLowerCase().includes(q) || t.short.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
      }
      return true
    })
  }, [search, category, level, letter])

  const grouped = useMemo(() => {
    const map: Record<string, GlossaryTerm[]> = {}
    for (const t of filtered) {
      const l = t.term[0].toUpperCase()
      if (!map[l]) map[l] = []
      map[l].push(t)
    }
    return map
  }, [filtered])

  return (
    <div className="min-h-screen text-white" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button onClick={() => router.push("/apprendre")}
            className="text-sm mb-4 flex items-center gap-1.5 transition-colors hover:text-white"
            style={{ color: "#555" }}>
            ← Académie
          </button>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-4xl">📖</span>
            <div>
              <h1 className="text-3xl font-black text-white">Glossaire financier</h1>
              <p className="text-sm mt-0.5" style={{ color: "#555" }}>{GLOSSARY.length} termes · Analyse technique, Crypto, Forex, Options, Macro</p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setLetter(null) }}
            placeholder="Rechercher un terme... (RSI, ETF, Pip, Delta...)"
            className="w-full px-5 py-4 rounded-2xl text-sm text-white placeholder-white/20 outline-none transition-all"
            style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
            onFocus={e => e.currentTarget.style.borderColor = "#333"}
            onBlur={e => e.currentTarget.style.borderColor = "#1a1a1a"}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-nowrap">
          {CATEGORIES.map(cat => (
            <button key={cat.key}
              onClick={() => setCategory(cat.key as any)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: category === cat.key ? "#1a1a1a" : "transparent",
                color: category === cat.key ? "#fff" : "#555",
                border: "1px solid " + (category === cat.key ? "#333" : "#1a1a1a"),
              }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex gap-2 mb-6">
          {(["all", "débutant", "intermédiaire", "avancé"] as const).map(lv => (
            <button key={lv}
              onClick={() => setLevel(lv)}
              className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
              style={{
                background: level === lv ? "#1a1a1a" : "transparent",
                color: level === lv ? "#fff" : "#444",
                border: "1px solid " + (level === lv ? "#333" : "#1a1a1a"),
              }}>
              {lv === "all" ? "Tous niveaux" : lv}
            </button>
          ))}
        </div>

        {/* Alphabet nav */}
        {!search && (
          <div className="flex flex-wrap gap-1 mb-6">
            {ALPHABET.map(l => {
              const has = GLOSSARY.some(t => t.term.toUpperCase().startsWith(l) &&
                (category === "all" || t.category === category) &&
                (level === "all" || t.level === level))
              return (
                <button key={l}
                  onClick={() => setLetter(letter === l ? null : l)}
                  disabled={!has}
                  className="w-7 h-7 rounded-lg text-[11px] font-black transition-all disabled:opacity-20"
                  style={{
                    background: letter === l ? "#fff" : "#111",
                    color: letter === l ? "#000" : "#555",
                    border: "1px solid " + (letter === l ? "#fff" : "#1a1a1a"),
                  }}>
                  {l}
                </button>
              )
            })}
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs" style={{ color: "#333" }}>{filtered.length} terme{filtered.length !== 1 ? "s" : ""}</p>
          {(search || letter || category !== "all" || level !== "all") && (
            <button onClick={() => { setSearch(""); setLetter(null); setCategory("all"); setLevel("all") }}
              className="text-xs font-bold px-3 py-1 rounded-lg transition-all"
              style={{ color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}>
              Réinitialiser
            </button>
          )}
        </div>

        {/* Grouped terms */}
        {Object.keys(grouped).sort().map(l => (
          <div key={l} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-black" style={{ color: "#333" }}>{l}</span>
              <div className="h-px flex-1" style={{ background: "#111" }} />
              <span className="text-[10px]" style={{ color: "#333" }}>{grouped[l].length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped[l].map((term, i) => (
                <TermCard key={term.term} term={term} index={i} onClick={() => setSelected(term)} />
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-sm" style={{ color: "#333" }}>Aucun terme trouvé pour "{search}"</p>
          </div>
        )}
      </div>

      {/* Term detail modal */}
      <AnimatePresence>
        {selected && (
          <TermModal
            term={selected}
            onClose={() => setSelected(null)}
            onNavigate={(id) => { setSelected(null); router.push(`/apprendre/${id}`) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
