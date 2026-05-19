import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { isAuthorized, loadGame, saveGame, setAuthorized } from './storage'
import type { GameState, PlayerStats, Woman } from './types'

const PASSWORD = 'loverhythm'
const affinityLabel = ['全然', '気になる', '好き', '大好き', 'エンドレス']
const womanNames = ['美咲', '彩乃', '琴音', '紗良', '莉子', '優衣']

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomStats = (): PlayerStats => {
  const rare = Math.random() < 0.12
  const startMin = rare ? 6 : 1
  const startMax = rare ? 9 : 5
  return { looks: rand(startMin, startMax), cleanliness: rand(startMin, startMax), talk: rand(startMin, startMax) }
}

const newGame = (): GameState => {
  const women: Woman[] = Math.random() < 0.05 ? [{ id: crypto.randomUUID(), name: womanNames[rand(0, womanNames.length - 1)], affinity: 1 }] : []
  return { day: 1, points: 24, stats: randomStats(), women, gameStatus: 'playing', bifurcationSuccesses: 0 }
}

const getScore = (g: GameState) => {
  const base = g.women.reduce((s, w) => s + [0, 100, 300, 600, 1000][w.affinity], 0)
  const lovers = g.women.filter((w) => w.affinity >= 2).length
  const bonus = lovers >= 3 ? 1000 : lovers >= 2 ? 500 : 0
  return base + bonus + (g.stats.looks + g.stats.cleanliness + g.stats.talk) * 50 + g.bifurcationSuccesses * 300
}

function PasswordPage() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  if (isAuthorized()) return <Navigate to="/game" replace />
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value === PASSWORD) {
      setAuthorized()
      location.href = '/game'
      return
    }
    setError('パスワードが違います。')
  }
  return <main className="card"><h1>ラブリズム</h1><p>友人向け限定公開</p><form onSubmit={submit}><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="パスワード" /><button>入場</button></form>{error && <p className="error">{error}</p>}</main>
}

function HelpPage() { return <main className="card"><h2>遊び方</h2><p>14日間、ポイントを使って行動し女性との親密度を高めます。</p><Link to="/game">ゲームへ</Link></main> }
function PrivacyPage() { return <main className="card"><h2>プライバシーポリシー</h2><p>データはlocalStorageにのみ保存されます。</p></main> }

function GamePage() {
  const navigate = useNavigate()
  if (!isAuthorized()) return <Navigate to="/" replace />
  const [state, setState] = useState<GameState>(() => loadGame() ?? newGame())
  const [selected, setSelected] = useState(0)

  const rank = useMemo(() => {
    const s = getScore(state)
    if (s >= 6500) return 'SSS'; if (s >= 5000) return 'SS'; if (s >= 3800) return 'S'; if (s >= 2600) return 'A'; if (s >= 1400) return 'B'; return 'C'
  }, [state])

  const endDay = (next: GameState) => {
    next.day += 1
    next.points += 24
    if (Math.random() < 0.3) {
      const i = rand(0, 3)
      if (i === 0) next.stats.looks = Math.min(10, next.stats.looks + 1)
      if (i === 1) next.stats.cleanliness = Math.max(1, next.stats.cleanliness - 1)
      if (i === 2) next.stats.talk = Math.min(10, next.stats.talk + 1)
    }
    const risky = next.women.filter((w) => w.affinity >= 2)
    if (risky.length >= 2 && Math.random() < 0.25) {
      const survive = Math.random() < (0.45 + next.stats.talk * 0.04)
      if (!survive) {
        next.gameStatus = 'gameover'
        next.gameOverReason = '二股がバレてしまった...'
      } else next.bifurcationSuccesses += 1
    }
    if (next.day > 14 && next.gameStatus === 'playing') next.gameStatus = 'clear'
    saveGame(next)
    setState({ ...next })
  }

  const pay = (cost: number) => state.points >= cost
  const action = (kind: 'hair' | 'clothes' | 'skin' | 'talk' | 'app' | 'gokon' | 'pick' | 'home' | 'walk' | 'sns') => {
    const next = structuredClone(state)
    const costs: Record<typeof kind, number> = { hair: 6, clothes: 8, skin: 5, talk: 6, app: 8, gokon: 10, pick: 6, home: 0, walk: 2, sns: 1 }
    if (!pay(costs[kind])) return
    next.points -= costs[kind]
    if (kind === 'hair') next.stats.looks = Math.min(10, next.stats.looks + 1)
    if (kind === 'clothes') { next.stats.looks = Math.min(10, next.stats.looks + 1); next.stats.cleanliness = Math.min(10, next.stats.cleanliness + 1) }
    if (kind === 'skin') next.stats.cleanliness = Math.min(10, next.stats.cleanliness + 1)
    if (kind === 'talk') next.stats.talk = Math.min(10, next.stats.talk + 1)
    if (['app', 'gokon', 'pick', 'sns'].includes(kind)) {
      const successRate = Math.min(0.9, (next.stats.looks + next.stats.cleanliness + next.stats.talk) / 30 + (kind === 'pick' ? -0.15 : 0.1))
      if (Math.random() < successRate) {
        if (next.women.length === 0 || Math.random() < 0.45) next.women.push({ id: crypto.randomUUID(), name: womanNames[rand(0, womanNames.length - 1)], affinity: 0 })
        const target = next.women[rand(0, next.women.length - 1)]
        target.affinity = Math.min(4, (target.affinity + (next.stats.talk >= 7 ? 2 : 1)) as 0 | 1 | 2 | 3 | 4)
      }
    }
    endDay(next)
  }

  if (state.gameStatus !== 'playing') {
    const finalScore = getScore(state)
    return <main className="card"><h1>{state.gameStatus === 'clear' ? '結果発表' : 'ゲームオーバー'}</h1><p>{state.gameOverReason}</p><p>最終スコア: {finalScore}</p><p>ランク: {rank}</p><p>親密な女性: {state.women.length}人</p><p>二股成功数: {state.bifurcationSuccesses}</p><button onClick={() => { const ng = newGame(); saveGame(ng); setState(ng) }}>もう一度遊ぶ</button><button onClick={() => navigate('/')}>タイトルへ戻る</button></main>
  }

  return <main className="container"><section className="card"><h1>ラブリズム</h1><p>{state.day}日目 / 残り{15 - state.day}日</p><p>ポイント: {state.points}</p><p>見た目{state.stats.looks} 清潔感{state.stats.cleanliness} トーク力{state.stats.talk}</p><div className="actions"><button onClick={() => action('hair')}>美容室(6)</button><button onClick={() => action('clothes')}>服を買う(8)</button><button onClick={() => action('skin')}>スキンケア(5)</button><button onClick={() => action('talk')}>会話練習(6)</button><button onClick={() => action('app')}>アプリ(8)</button><button onClick={() => action('gokon')}>合コン(10)</button><button onClick={() => action('pick')}>ナンパ(6)</button><button onClick={() => action('home')}>休む(0)</button><button onClick={() => action('walk')}>散歩(2)</button><button onClick={() => action('sns')}>SNS(1)</button></div><button onClick={() => saveGame(state)}>セーブ</button><button onClick={() => navigate('/')}>タイトルへ戻る</button></section>
  <section className="card"><h2>親密な女性</h2>{state.women.length === 0 ? <p>まだ出会いがありません。</p> : <>{<div className="tabs">{state.women.map((w, i) => <button key={w.id} onClick={() => setSelected(i)}>{w.name}</button>)}</div>}<p>名前: {state.women[selected]?.name}</p><p>好感度: {affinityLabel[state.women[selected]?.affinity ?? 0]}</p></>}</section></main>
}

export function App() {
  return <Routes><Route path="/" element={<PasswordPage />} /><Route path="/game" element={<GamePage />} /><Route path="/help" element={<HelpPage />} /><Route path="/privacy" element={<PrivacyPage />} /></Routes>
}
