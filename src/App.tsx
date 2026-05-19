import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { isAuthorized, loadGame, saveGame, setAuthorized } from './storage'
import type { Affinity, GameState, Girl, PlayerStats } from './types'

const PASSWORD = 'loverhythm'
const affinityLabel = ['全然', '気になる', '好き', '大好き', 'エンドレス']
const affinityClass = ['zero', 'one', 'two', 'three', 'four']

const GIRL_MASTER = [
  { name: 'あかり', image: '/images/girls/akari.webp', comment: '一緒にいると落ち着くね。' },
  { name: 'みさき', image: '/images/girls/misaki.webp', comment: '次はどこに行く？' },
  { name: 'ゆい', image: '/images/girls/yui.webp', comment: 'もっとあなたを知りたいな。' },
  { name: 'ことね', image: '/images/girls/kotone.webp', comment: '今日は良い日になりそう。' }
]

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomStats = (): PlayerStats => {
  const rare = Math.random() < 0.12
  return {
    looks: rand(rare ? 6 : 1, rare ? 9 : 5),
    cleanliness: rand(rare ? 6 : 1, rare ? 9 : 5),
    talk: rand(rare ? 6 : 1, rare ? 9 : 5)
  }
}

const toGirl = (index: number, discovered = false): Girl => ({
  id: `girl-${index}`,
  ...GIRL_MASTER[index],
  affinity: 0,
  discovered
})

const createNewGame = (): GameState => {
  const girls = GIRL_MASTER.map((_, i) => toGirl(i, false))
  if (Math.random() < 0.08) {
    const i = rand(0, girls.length - 1)
    girls[i].discovered = true
    girls[i].affinity = 1
  }
  return { day: 1, points: 24, stats: randomStats(), girls, gameStatus: 'playing', bifurcationSuccesses: 0, logs: [] }
}

const scoreOf = (s: GameState) => {
  const safeGirls = s.girls ?? []
  const base = safeGirls.filter((g) => g.discovered).reduce((sum, g) => sum + [0, 100, 300, 600, 1000][g.affinity], 0)
  const lovers = safeGirls.filter((g) => g.affinity >= 2).length
  const bonus = lovers >= 3 ? 1000 : lovers >= 2 ? 500 : 0
  return base + bonus + (s.stats.looks + s.stats.cleanliness + s.stats.talk) * 50 + s.bifurcationSuccesses * 300
}

function PasswordPage() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  if (isAuthorized()) return <Navigate to="/game" replace />
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value === PASSWORD) {
      setAuthorized()
      location.href = '/game'
      return
    }
    setError('パスワードが違います。')
  }
  return <main className="entry"><div className="glass"><h1>ラブリズム</h1><p>友人向け限定公開</p><form onSubmit={onSubmit}><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="password" /><button>入場</button></form>{error && <p className="error">{error}</p>}</div></main>
}

function GamePage() {
  const navigate = useNavigate()
  if (!isAuthorized()) return <Navigate to="/" replace />
  const [state, setState] = useState<GameState>(() => loadGame() ?? createNewGame())
  const [selected, setSelected] = useState(0)
  const girls = state.girls ?? []
  const selectedGirl = girls[selected]

  const rank = useMemo(() => {
    const s = scoreOf(state)
    if (s >= 6500) return 'SSS'; if (s >= 5000) return 'SS'; if (s >= 3800) return 'S'; if (s >= 2600) return 'A'; if (s >= 1400) return 'B'; return 'C'
  }, [state])

  const endDay = (next: GameState) => {
    next.day += 1
    next.points += 24
    const risky = (next.girls ?? []).filter((g) => g.affinity >= 2)
    if (risky.length >= 2 && Math.random() < 0.25) {
      if (Math.random() > 0.45 + next.stats.talk * 0.04) {
        next.gameStatus = 'gameover'
        next.gameOverReason = '二股がバレてしまった...'
      } else {
        next.bifurcationSuccesses += 1
        next.logs.unshift({ day: next.day, text: '修羅場を回避した。トーク力で切り抜けた！' })
      }
    }
    if (next.day > 14 && next.gameStatus === 'playing') next.gameStatus = 'clear'
    saveGame(next)
    setState(next)
  }

  const improve = (key: keyof PlayerStats, amount: number, cost: number, text: string) => {
    if (state.points < cost) return
    const next = structuredClone(state)
    next.points -= cost
    next.stats[key] = Math.min(10, next.stats[key] + amount)
    next.logs.unshift({ day: next.day, text })
    endDay(next)
  }

  const meet = (cost: number, text: string, penalty = 0) => {
    if (state.points < cost) return
    const next = structuredClone(state)
    next.points -= cost
    const successRate = Math.min(0.9, (next.stats.looks + next.stats.cleanliness + next.stats.talk) / 30 + 0.1 - penalty)
    if (Math.random() < successRate) {
      const nextGirls = next.girls ?? []
      const available = nextGirls.filter((g) => !g.discovered)
      const girl = available.length > 0 && Math.random() < 0.5 ? available[0] : (nextGirls.length > 0 ? nextGirls[rand(0, nextGirls.length - 1)] : undefined)
      if (girl) {
        girl.discovered = true
        girl.affinity = Math.min(4, girl.affinity + (next.stats.talk >= 7 ? 2 : 1)) as Affinity
        next.logs.unshift({ day: next.day, text: `${girl.name} と出会って好感度アップ！`, affinityLabel: affinityLabel[girl.affinity] })
      }
    } else {
      next.logs.unshift({ day: next.day, text: `${text}は不発に終わった...` })
    }
    endDay(next)
  }

  if (state.gameStatus !== 'playing') {
    return <main className="entry"><div className="glass"><h1>{state.gameStatus === 'clear' ? '結果発表' : 'ゲームオーバー'}</h1><p>{state.gameOverReason}</p><p>スコア: {scoreOf(state)} / ランク: {rank}</p><button onClick={() => { const ng = createNewGame(); saveGame(ng); setState(ng) }}>もう一度遊ぶ</button><button onClick={() => navigate('/')}>タイトルへ戻る</button></div></main>
  }

  return <main className="dashboard">
    <aside className="left panel">
      <h1>ラブリズム</h1>
      <small>LOVE RHYTHM</small>
      <nav>
        <button>ホーム</button><button>ステータス</button><button>彼女たち</button><button onClick={() => saveGame(state)}>セーブ</button><Link to="/help">ヘルプ</Link><button onClick={() => navigate('/')}>タイトルへ戻る</button>
      </nav>
      <div className="version">v1.1.0</div>
    </aside>

    <section className="center panel">
      <article className="hero">
        {selectedGirl ? (selectedGirl.discovered ? <img src={selectedGirl.image} alt={selectedGirl.name} /> : <div className="locked">🔒 未発見</div>) : <div className="locked">まだ出会っていません</div>}
        <div className="overlay"><h2>{selectedGirl ? (selectedGirl.discovered ? selectedGirl.name : '???') : '---'}</h2>{selectedGirl ? <span className={`badge ${affinityClass[selectedGirl.affinity]}`}>{affinityLabel[selectedGirl.affinity]}</span> : null}<p>{selectedGirl ? (selectedGirl.discovered ? selectedGirl.comment : '出会いを探そう。') : 'まだ出会っていません'}</p></div>
      </article>
      <div className="thumbs">{girls.map((g, i) => <button key={g.id} className={`thumb ${selected===i?'active':''}`} onClick={() => setSelected(i)}>{g.discovered ? <img src={g.image} alt={g.name} /> : <div className='lockedSmall'>🔒</div>}<span>{g.discovered ? g.name : '未発見'}</span></button>)}</div>
    </section>

    <aside className="right panel">
      <div className="card"><h3>DAY {String(state.day).padStart(2,'0')} / 14</h3><p>残り{14-state.day+1}日</p><p className="point">{state.points} pt</p></div>
      <div className="card"><h3>あなたのステータス</h3><p>見た目 Lv.{state.stats.looks}</p><progress max={10} value={state.stats.looks} /><p>清潔感 Lv.{state.stats.cleanliness}</p><progress max={10} value={state.stats.cleanliness} /><p>トーク力 Lv.{state.stats.talk}</p><progress max={10} value={state.stats.talk} /></div>
      <div className="card actions"><h3>行動を選択</h3><button onClick={() => improve('looks',1,6,'美容室に行って見た目+1')}>自分磨き</button><button onClick={() => meet(8,'マッチング',0)}>出会い</button><button onClick={() => improve('talk',1,1,'休憩して気力回復')}>休憩</button></div>
      <div className="card"><h3>今日のヒント</h3><p>清潔感を上げると、第一印象が良くなる！</p></div>
      <div className="card"><h3>直近イベントログ</h3>{state.logs.length===0?<p>まだイベントなし</p>:state.logs.map((l,idx)=><p key={idx}>DAY{l.day}: {l.text} {l.affinityLabel ? `(${l.affinityLabel})` : ''}</p>)}</div>
    </aside>
  </main>
}

function HelpPage() { return <main className="entry"><div className="glass"><h2>遊び方</h2><p>行動して14日間でスコアを伸ばそう。</p><Link to="/game">ゲームへ戻る</Link></div></main> }
function PrivacyPage() { return <main className="entry"><div className="glass"><h2>プライバシーポリシー</h2><p>保存はブラウザ内 localStorage のみ。</p></div></main> }

export function App() {
  return <Routes><Route path="/" element={<PasswordPage />} /><Route path="/game" element={<GamePage />} /><Route path="/help" element={<HelpPage />} /><Route path="/privacy" element={<PrivacyPage />} /></Routes>
}
