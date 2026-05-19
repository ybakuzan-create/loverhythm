import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { isAuthorized, loadGame, saveGame, setAuthorized } from './storage'
import type { Affinity, GameState, Girl, PlayerStats } from './types'

const PASSWORD = 'loverhythm'
const affinityLabel = ['全然', '気になる', '好き', '大好き', 'エンドレス']
const affinityClass = ['zero', 'one', 'two', 'three', 'four']
const AFFINITY_THRESHOLDS = [0, 30, 70, 120, 180]

const GIRL_MASTER = [
  { id: 'akari', name: 'あかり', image: '/images/girls/akari.png', comment: '一緒にいると落ち着くね。' },
  { id: 'misaki', name: 'みさき', image: '/images/girls/misaki.png', comment: '次はどこに行く？' },
  { id: 'yui', name: 'ゆい', image: '/images/girls/yui.png', comment: 'もっとあなたを知りたいな。' },
  { id: 'kotone', name: 'ことね', image: '/images/girls/kotone.png', comment: '今日は良い日になりそう。' }
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
  ...GIRL_MASTER[index],
  affinity: 0,
  affinityExp: 0,
  discovered
})

const createNewGame = (): GameState => {
  const girls = GIRL_MASTER.map((_, i) => toGirl(i, false))
  if (Math.random() < 0.08) {
    const i = rand(0, girls.length - 1)
    girls[i].discovered = true
    girls[i].affinity = 1
    girls[i].affinityExp = AFFINITY_THRESHOLDS[1]
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

const affinityFromExp = (exp: number): Affinity => {
  if (exp >= AFFINITY_THRESHOLDS[4]) return 4
  if (exp >= AFFINITY_THRESHOLDS[3]) return 3
  if (exp >= AFFINITY_THRESHOLDS[2]) return 2
  if (exp >= AFFINITY_THRESHOLDS[1]) return 1
  return 0
}

const getGirlImagePath = (girl: Girl) => `/images/girls/${girl.id}_${girl.affinity}.png`

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
  const [rankupMessage, setRankupMessage] = useState<string | null>(null)
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

  const applyAffinityExp = (next: GameState, girl: Girl, gain: number) => {
    const before = girl.affinity
    girl.affinityExp = Math.max(0, girl.affinityExp + gain)
    girl.affinity = affinityFromExp(girl.affinityExp)
    if (girl.affinity > before) setRankupMessage(`${girl.name}のランクが「${affinityLabel[girl.affinity]}」に上がりました！`)
    next.logs.unshift({ day: next.day, text: `${girl.name}との親密度が上がった (+${gain})`, affinityLabel: affinityLabel[girl.affinity] })
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
        applyAffinityExp(next, girl, next.stats.talk >= 7 ? 14 : 10)
      }
    } else {
      next.logs.unshift({ day: next.day, text: `${text}は不発に終わった...` })
    }
    endDay(next)
  }

  const interact = (mode: 'date' | 'meal' | 'hotel') => {
    if (!selectedGirl || !selectedGirl.discovered) return
    const cost = mode === 'date' ? 6 : mode === 'meal' ? 4 : 8
    if (state.points < cost) return
    const next = structuredClone(state)
    next.points -= cost
    const girl = (next.girls ?? [])[selected]
    if (!girl) return endDay(next)

    if (mode === 'date' || mode === 'meal') {
      const statTotal = next.stats.looks + next.stats.cleanliness + next.stats.talk
      const gain = mode === 'date' ? rand(8, 16) + Math.floor(statTotal / 5) : rand(5, 12) + Math.floor(statTotal / 6)
      applyAffinityExp(next, girl, gain)
      return endDay(next)
    }

    const before = girl.affinity
    if (before === 1 || before === 2) {
      girl.affinity = (before - 1) as Affinity
      girl.affinityExp = AFFINITY_THRESHOLDS[girl.affinity]
      next.logs.unshift({ day: next.day, text: `${girl.name}との空気が悪くなった...`, affinityLabel: affinityLabel[girl.affinity] })
    } else if (before === 3) {
      girl.affinity = 4
      girl.affinityExp = AFFINITY_THRESHOLDS[4]
      setRankupMessage(`${girl.name}のランクが「${affinityLabel[girl.affinity]}」に上がりました！`)
      next.logs.unshift({ day: next.day, text: `${girl.name}との関係が急接近した！`, affinityLabel: affinityLabel[girl.affinity] })
    } else if (before === 4) {
      next.logs.unshift({ day: next.day, text: 'すでにエンドレスです', affinityLabel: affinityLabel[girl.affinity] })
    } else {
      next.logs.unshift({ day: next.day, text: 'まだ早すぎた', affinityLabel: affinityLabel[girl.affinity] })
    }
    endDay(next)
  }

  if (state.gameStatus !== 'playing') {
    return <main className="entry"><div className="glass"><h1>{state.gameStatus === 'clear' ? '結果発表' : 'ゲームオーバー'}</h1><p>{state.gameOverReason}</p><p>スコア: {scoreOf(state)} / ランク: {rank}</p><button onClick={() => { const ng = createNewGame(); saveGame(ng); setState(ng) }}>もう一度遊ぶ</button><button onClick={() => navigate('/')}>タイトルへ戻る</button></div></main>
  }

  return <main className="dashboard">
    {rankupMessage && <div className="modalBackdrop"><div className="modal"><p>{rankupMessage}</p><button onClick={() => setRankupMessage(null)}>OK</button></div></div>}
    <aside className="left panel">
      <h2>出会った女性</h2>
      <div className="girlList">{girls.map((g, i) => <button key={g.id} className={`girlCard ${selected===i?'active':''}`} onClick={() => setSelected(i)}>{g.discovered ? <img src={getGirlImagePath(g)} alt={g.name} onError={(e) => { e.currentTarget.src = '/images/girls/placeholder.png' }} /> : <div className='lockedSmall'>🔒</div>}<div className="girlMeta"><strong>{g.discovered ? g.name : '未発見'}</strong><span className={`badge ${affinityClass[g.affinity]}`}>{g.discovered ? affinityLabel[g.affinity] : '未発見'}</span></div></button>)}</div>
    </aside>

    <section className="center panel">
      <article className="hero">
        {selectedGirl ? (selectedGirl.discovered ? <img src={getGirlImagePath(selectedGirl)} alt={selectedGirl.name} onError={(e) => { e.currentTarget.src = '/images/girls/placeholder.png' }} /> : <div className="locked">🔒 未発見</div>) : <div className="locked">まだ出会っていません</div>}
        <div className="overlay">
          <div className="heroTitleRow"><h2>{selectedGirl ? (selectedGirl.discovered ? selectedGirl.name : '???') : '---'}</h2>{selectedGirl ? <span className={`badge ${affinityClass[selectedGirl.affinity]}`}>{affinityLabel[selectedGirl.affinity]}</span> : null}</div>
          {selectedGirl?.discovered ? <div className="girlActions"><button onClick={() => interact('date')}>デート</button><button onClick={() => interact('meal')}>ご飯</button><button onClick={() => interact('hotel')}>ホテル</button></div> : null}
          <p>{selectedGirl ? (selectedGirl.discovered ? `${selectedGirl.comment}（親密度EXP: ${selectedGirl.affinityExp}）` : '出会いを探そう。') : 'まだ出会っていません'}</p>
        </div>
      </article>
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
