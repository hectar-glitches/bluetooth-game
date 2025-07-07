"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Bluetooth, Users, Wifi, WifiOff, Trophy, Target, Gamepad2, Volume2, VolumeX } from "lucide-react"
import { GameEngine } from "@/lib/game-engine"
import { BluetoothManager } from "@/lib/bluetooth-manager"
import { AudioManager } from "@/lib/audio-manager"

type ConnectionState = "disconnected" | "connecting" | "connected"
type GameState = "lobby" | "playing" | "paused" | "finished"

interface PlayerStats {
  id: string
  name: string
  score: number
  kills: number
  deaths: number
  health: number
  shield: number
  energy: number
}

interface GameStats {
  players: PlayerStats[]
  gameTime: number
  powerUpsCollected: number
  totalShots: number
}

export default function StellarClash() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const bluetoothManagerRef = useRef<BluetoothManager | null>(null)
  const audioManagerRef = useRef<AudioManager | null>(null)
  const animationFrameRef = useRef<number>()

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [gameState, setGameState] = useState<GameState>("lobby")
  const [isHost, setIsHost] = useState<boolean>(false)
  const [playerId, setPlayerId] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [gameStats, setGameStats] = useState<GameStats>({
    players: [],
    gameTime: 0,
    powerUpsCollected: 0,
    totalShots: 0,
  })
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showControls, setShowControls] = useState(false)

  // Initialize game systems
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Initialize game engine
    gameEngineRef.current = new GameEngine(canvas)

    // Initialize audio manager
    audioManagerRef.current = new AudioManager()

    // Initialize bluetooth manager
    bluetoothManagerRef.current = new BluetoothManager({
      onConnectionStateChange: setConnectionState,
      onGameDataReceived: handleGameDataReceived,
      onError: setError,
    })

    // Set up game loop
    const gameLoop = () => {
      if (gameEngineRef.current && gameState === "playing") {
        gameEngineRef.current.update()
        gameEngineRef.current.render()

        // Update game stats
        const stats = gameEngineRef.current.getGameStats()
        setGameStats(stats)

        // Check for game end conditions
        if (gameEngineRef.current.isGameFinished()) {
          setGameState("finished")
        }
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      gameEngineRef.current?.cleanup()
      bluetoothManagerRef.current?.disconnect()
      audioManagerRef.current?.cleanup()
    }
  }, [gameState])

  const handleGameDataReceived = useCallback((data: any) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.handleNetworkUpdate(data)
    }
  }, [])

  const startAsHost = async () => {
    try {
      setError("")
      if (!bluetoothManagerRef.current) return

      const id = await bluetoothManagerRef.current.startAsHost()
      setPlayerId(id)
      setIsHost(true)

      if (gameEngineRef.current) {
        gameEngineRef.current.initializeAsHost(id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start as host")
    }
  }

  const joinGame = async () => {
    try {
      setError("")
      if (!bluetoothManagerRef.current) return

      const id = await bluetoothManagerRef.current.joinGame()
      setPlayerId(id)
      setIsHost(false)

      if (gameEngineRef.current) {
        gameEngineRef.current.initializeAsClient(id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game")
    }
  }

  const startGame = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.startGame()
      setGameState("playing")

      if (audioManagerRef.current && soundEnabled) {
        audioManagerRef.current.playGameStart()
      }
    }
  }

  const pauseGame = () => {
    setGameState(gameState === "paused" ? "playing" : "paused")
  }

  const resetGame = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.resetGame()
      setGameState("lobby")
      setGameStats({
        players: [],
        gameTime: 0,
        powerUpsCollected: 0,
        totalShots: 0,
      })
    }
  }

  const disconnect = () => {
    bluetoothManagerRef.current?.disconnect()
    setGameState("lobby")
    setPlayerId("")
  }

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled)
    if (audioManagerRef.current) {
      audioManagerRef.current.setEnabled(!soundEnabled)
    }
  }

  const getStatusIcon = () => {
    switch (connectionState) {
      case "connected":
        return <Wifi className="w-4 h-4 text-green-500" />
      case "connecting":
        return <Bluetooth className="w-4 h-4 text-blue-500 animate-pulse" />
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Stellar Clash
            </h1>
            <p className="text-gray-400">Real-time Bluetooth Space Combat</p>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={toggleSound} className="text-white hover:bg-white/10">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>

            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <Badge variant={connectionState === "connected" ? "default" : "secondary"}>{connectionState}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Game Canvas */}
          <div className="lg:col-span-3">
            <Card className="bg-black/50 border-gray-700">
              <CardContent className="p-0">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="w-full h-auto border border-gray-700 rounded-lg"
                    style={{ maxHeight: "600px" }}
                  />

                  {gameState === "lobby" && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                      <div className="text-center space-y-4">
                        <h2 className="text-2xl font-bold">Ready to Battle?</h2>
                        {connectionState === "disconnected" ? (
                          <div className="space-y-3">
                            <Button onClick={startAsHost} size="lg" className="w-full">
                              <Users className="w-4 h-4 mr-2" />
                              Host Battle
                            </Button>
                            <Button onClick={joinGame} variant="outline" size="lg" className="w-full bg-transparent">
                              <Bluetooth className="w-4 h-4 mr-2" />
                              Join Battle
                            </Button>
                          </div>
                        ) : connectionState === "connected" ? (
                          <Button onClick={startGame} size="lg">
                            <Target className="w-4 h-4 mr-2" />
                            Launch Game
                          </Button>
                        ) : (
                          <div className="text-blue-400">Connecting...</div>
                        )}
                      </div>
                    </div>
                  )}

                  {gameState === "paused" && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                      <div className="text-center space-y-4">
                        <h2 className="text-2xl font-bold">Game Paused</h2>
                        <Button onClick={pauseGame} size="lg">
                          Resume Battle
                        </Button>
                      </div>
                    </div>
                  )}

                  {gameState === "finished" && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                      <div className="text-center space-y-4">
                        <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
                        <h2 className="text-2xl font-bold">Battle Complete!</h2>
                        <div className="space-x-2">
                          <Button onClick={resetGame} size="lg">
                            New Battle
                          </Button>
                          <Button onClick={disconnect} variant="outline" size="lg">
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <Card className="mt-4 bg-black/30 border-gray-700">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Controls</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowControls(!showControls)}>
                    <Gamepad2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              {showControls && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-semibold mb-2">Movement</div>
                      <div>WASD - Move ship</div>
                      <div>Mouse - Aim</div>
                    </div>
                    <div>
                      <div className="font-semibold mb-2">Combat</div>
                      <div>Click - Fire weapons</div>
                      <div>Space - Boost</div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Game Stats Panel */}
          <div className="space-y-4">
            {/* Player Stats */}
            <Card className="bg-black/30 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Player Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gameStats.players.map((player) => (
                  <div key={player.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{player.name}</span>
                      <Badge variant="outline">{player.score}</Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Health</span>
                        <span>{player.health}%</span>
                      </div>
                      <Progress value={player.health} className="h-2" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Shield</span>
                        <span>{player.shield}%</span>
                      </div>
                      <Progress value={player.shield} className="h-2 bg-blue-900" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Energy</span>
                        <span>{player.energy}%</span>
                      </div>
                      <Progress value={player.energy} className="h-2 bg-yellow-900" />
                    </div>

                    <div className="flex justify-between text-xs text-gray-400">
                      <span>K: {player.kills}</span>
                      <span>D: {player.deaths}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Game Info */}
            <Card className="bg-black/30 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Battle Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Time</span>
                  <span>{formatTime(gameStats.gameTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Power-ups</span>
                  <span>{gameStats.powerUpsCollected}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Shots</span>
                  <span>{gameStats.totalShots}</span>
                </div>
              </CardContent>
            </Card>

            {/* Game Actions */}
            {gameState === "playing" && (
              <Card className="bg-black/30 border-gray-700">
                <CardContent className="pt-6 space-y-2">
                  <Button onClick={pauseGame} variant="outline" className="w-full bg-transparent">
                    {gameState === "paused" ? "Resume" : "Pause"}
                  </Button>
                  <Button onClick={disconnect} variant="destructive" className="w-full">
                    Disconnect
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Technical Info */}
            <Card className="bg-black/30 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Technical Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1 text-gray-400">
                  <li>• Real-time physics simulation</li>
                  <li>• Bluetooth P2P networking</li>
                  <li>• Canvas-based rendering</li>
                  <li>• Particle systems</li>
                  <li>• Collision detection</li>
                  <li>• Audio synthesis</li>
                  <li>• State synchronization</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
