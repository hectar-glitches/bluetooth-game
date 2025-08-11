/**
 * Represents a 2D vector with x and y coordinates
 */
export interface Vector2D {
  x: number
  y: number
}

/**
 * Base interface for all game objects with common properties
 */
export interface GameObject {
  id: string                // Unique identifier
  position: Vector2D        // Current position in the game world
  velocity: Vector2D        // Current movement speed and direction
  rotation: number          // Rotation angle in radians
  health: number            // Current health points
  maxHealth: number         // Maximum possible health
  active: boolean           // Whether the object is active in the game
}

/**
 * Player entity that extends GameObject with additional player-specific properties
 */
export interface Player extends GameObject {
  playerId: string          // Player's unique identifier
  score: number             // Current score
  kills: number             // Number of other players killed
  deaths: number            // Number of times player has died
  shield: number            // Current shield value
  maxShield: number         // Maximum shield capacity
  energy: number            // Current energy level for special abilities
  maxEnergy: number         // Maximum energy capacity
  weaponCooldown: number    // Time remaining until player can shoot again
  boostCooldown: number     // Time remaining until player can boost again
}

/**
 * Projectile fired by players that can damage other players and objects
 */
export interface Projectile extends GameObject {
  ownerId: string           // ID of the player who fired this projectile
  damage: number            // Amount of damage this projectile deals on hit
  lifetime: number          // Time remaining before projectile disappears
}

/**
 * Power-up item that players can collect for various benefits
 */
export interface PowerUp extends GameObject {
  type: "health" | "shield" | "energy" | "weapon"  // Type determines effect when collected
  value: number             // Amount of benefit provided
  respawnTime: number       // Time until power-up reappears after collection
}

/**
 * Obstacle in the game world that players must navigate around
 */
export interface Asteroid extends GameObject {
  size: number              // Size of the asteroid (affects collision radius)
  rotationSpeed: number     // How fast the asteroid rotates
}

/**
 * Visual effect particle for explosions, engine trails, etc.
 */
export interface Particle {
  position: Vector2D        // Current position
  velocity: Vector2D        // Movement direction and speed
  color: string             // CSS color string
  life: number              // Current lifetime remaining
  maxLife: number           // Maximum lifetime
  size: number              // Size of the particle
}

/**
 * Main game engine class responsible for managing all game objects, physics, rendering,
 * player input, and networking.
 */
export class GameEngine {
  private canvas: HTMLCanvasElement               // Drawing surface
  private ctx: CanvasRenderingContext2D           // Canvas drawing context
  private players: Map<string, Player> = new Map() // All players in the game
  private projectiles: Projectile[] = []          // All active projectiles
  private powerUps: PowerUp[] = []                // All power-ups in the game
  private asteroids: Asteroid[] = []              // All asteroids in the game
  private particles: Particle[] = []              // Visual effect particles
  private gameTime = 0                            // Elapsed game time in seconds
  private lastUpdate = 0                          // Last update timestamp
  private isHost = false                          // Whether this client is the host
  private localPlayerId = ""                      // ID of the local player
  private keys: Set<string> = new Set()           // Currently pressed keys
  private mouse: { x: number; y: number; pressed: boolean } = { x: 0, y: 0, pressed: false } // Mouse state
  private networkUpdateCallback?: (data: any) => void // Callback for sending network updates

  /**
   * Creates a new GameEngine instance
   * @param canvas The HTML canvas element where the game will be rendered
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")
    this.ctx = ctx

    this.setupEventListeners()
    this.generateAsteroids()
    this.generatePowerUps()
  }

  /**
   * Sets up event listeners for keyboard and mouse input
   * @private
   */
  private setupEventListeners() {
    // Keyboard events
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code)
      if (e.code === "Space") {
        e.preventDefault()
      }
    })

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code)
    })

    // Mouse events
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect()
      this.mouse.x = e.clientX - rect.left
      this.mouse.y = e.clientY - rect.top
    })

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.mouse.pressed = true
        this.handleShooting()
      }
    })

    this.canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        this.mouse.pressed = false
      }
    })
  }

  /**
   * Initializes the game in host mode
   * @param playerId The unique identifier for the host player
   */
  initializeAsHost(playerId: string) {
    this.isHost = true
    this.localPlayerId = playerId
    this.createPlayer(playerId, "Host", { x: 100, y: 300 })
  }

  /**
   * Initializes the game in client mode
   * @param playerId The unique identifier for the client player
   */
  initializeAsClient(playerId: string) {
    this.isHost = false
    this.localPlayerId = playerId
    this.createPlayer(playerId, "Client", { x: 700, y: 300 })
  }
  
  private _debugMode = false;
  private _debugInterval: any = null;
  
  /**
   * Adds a computer-controlled player for debugging/testing without a second player
   * @param playerId The unique identifier for the debug player
   */
  addDebugPlayer(playerId: string) {
    // This method is used only in debug mode to add a simulated second player
    this._debugMode = true;
    this.createPlayer(playerId, "Debug Player", { x: 700, y: 300 });
    
    // Set up auto-movement for the debug player
    this._debugInterval = setInterval(() => {
      const debugPlayer = this.players.get(playerId);
      if (debugPlayer) {
        // Simple AI behavior - random movement
        const randomX = (Math.random() - 0.5) * 2;
        const randomY = (Math.random() - 0.5) * 2;
        
        debugPlayer.velocity.x = randomX * 100;
        debugPlayer.velocity.y = randomY * 100;
        
        // Occasionally shoot
        if (Math.random() > 0.95) {
          // Create a projectile for the debug player
          const projectile: Projectile = {
            id: `projectile_${Date.now()}_${Math.random()}`,
            position: { ...debugPlayer.position },
            velocity: {
              x: Math.cos(debugPlayer.rotation) * 400,
              y: Math.sin(debugPlayer.rotation) * 400,
            },
            rotation: debugPlayer.rotation,
            health: 1,
            maxHealth: 1,
            ownerId: debugPlayer.playerId,
            damage: 25,
            lifetime: 3,
            active: true,
          };
          
          this.projectiles.push(projectile);
        }
      }
    }, 100);
  }

  /**
   * Creates a new player and adds them to the game
   * @param id The unique identifier for the player
   * @param name The display name for the player
   * @param position The starting position for the player
   * @returns The newly created Player object
   * @private
   */
  private createPlayer(id: string, name: string, position: Vector2D): Player {
    const player: Player = {
      id,
      playerId: id,
      position,
      velocity: { x: 0, y: 0 },
      rotation: 0,
      health: 100,
      maxHealth: 100,
      shield: 100,
      maxShield: 100,
      energy: 100,
      maxEnergy: 100,
      score: 0,
      kills: 0,
      deaths: 0,
      weaponCooldown: 0,
      boostCooldown: 0,
      active: true,
    }

    this.players.set(id, player)
    return player
  }

  /**
   * Generates asteroids and places them randomly in the game world
   * @private
   */
  private generateAsteroids() {
    for (let i = 0; i < 25; i++) {
      const asteroid: Asteroid = {
        id: `asteroid_${i}`,
        position: {
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
        },

        velocity: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        },

        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        health: 50,
        maxHealth: 50,
        size: 20 + Math.random() * 30,
        active: true,
      }

      this.asteroids.push(asteroid)
    }
  }

  /**
   * Generates power-ups and places them randomly in the game world
   * @private
   */
  private generatePowerUps() {
    const types: PowerUp["type"][] = ["health", "shield", "energy", "weapon"]

    for (let i = 0; i < 8; i++) {
      const powerUp: PowerUp = {
        id: `powerup_${i}`,
        position: {
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
        },

        velocity: { x: 0, y: 0 },
        rotation: 0,
        health: 1,
        maxHealth: 1,
        type: types[Math.floor(Math.random() * types.length)],
        value: 25 + Math.random() * 25,
        respawnTime: 0,
        active: true,
      }
      this.powerUps.push(powerUp)
    }
  }

  /**
   * Main game update loop that advances the game state
   * Updates all game objects, handles physics, collisions, and networking
   */
  update() {
    const now = performance.now()
    const deltaTime = (now - this.lastUpdate) / 1000
    this.lastUpdate = now
    this.gameTime += deltaTime

    this.updatePlayers(deltaTime)
    this.updateProjectiles(deltaTime)
    this.updatePowerUps(deltaTime)
    this.updateAsteroids(deltaTime)
    this.updateParticles(deltaTime)
    this.checkCollisions()

    if (this.isHost) {
      this.sendNetworkUpdate()
    }
  }

  /**
   * Updates all players' positions, physics, and regeneration
   * @param deltaTime Time elapsed since the last update in seconds
   * @private
   */
  private updatePlayers(deltaTime: number) {
    const localPlayer = this.players.get(this.localPlayerId)
    if (!localPlayer) return

    // Handle input for local player
    this.handlePlayerInput(localPlayer, deltaTime)

    // Update all players
    this.players.forEach((player) => {
      // Apply physics
      player.position.x += player.velocity.x * deltaTime * 60
      player.position.y += player.velocity.y * deltaTime * 60

      // Apply drag
      player.velocity.x *= 0.98
      player.velocity.y *= 0.98

      // Wrap around screen
      if (player.position.x < 0) player.position.x = this.canvas.width
      if (player.position.x > this.canvas.width) player.position.x = 0
      if (player.position.y < 0) player.position.y = this.canvas.height
      if (player.position.y > this.canvas.height) player.position.y = 0

      // Regenerate shield and energy
      if (player.shield < player.maxShield) {
        player.shield = Math.min(player.maxShield, player.shield + 10 * deltaTime)
      }
      if (player.energy < player.maxEnergy) {
        player.energy = Math.min(player.maxEnergy, player.energy + 20 * deltaTime)
      }

      // Update cooldowns
      if (player.weaponCooldown > 0) {
        player.weaponCooldown -= deltaTime
      }
      if (player.boostCooldown > 0) {
        player.boostCooldown -= deltaTime
      }
    })
  }

  /**
   * Processes player input for movement, rotation, boost, and targeting.
   * Handles keyboard input for movement and special actions, as well as mouse input for aiming.
   * 
   * @param player The player object to update based on input
   * @param deltaTime Time elapsed since the last frame in seconds
   */
  private handlePlayerInput(player: Player, deltaTime: number) {
    const speed = 200
    const rotationSpeed = 3

    // Movement
    if (this.keys.has("KeyW")) {
      const thrust = 5
      player.velocity.x += Math.cos(player.rotation) * thrust * deltaTime
      player.velocity.y += Math.sin(player.rotation) * thrust * deltaTime

      // Add engine particles
      this.addEngineParticles(player)
    }
    if (this.keys.has("KeyS")) {
      const thrust = 3
      player.velocity.x -= Math.cos(player.rotation) * thrust * deltaTime
      player.velocity.y -= Math.sin(player.rotation) * thrust * deltaTime
    }
    if (this.keys.has("KeyA")) {
      player.rotation -= rotationSpeed * deltaTime
    }
    if (this.keys.has("KeyD")) {
      player.rotation += rotationSpeed * deltaTime
    }

    // Boost
    if (this.keys.has("Space") && player.energy > 20 && player.boostCooldown <= 0) {
      const boostPower = 10
      player.velocity.x += Math.cos(player.rotation) * boostPower * deltaTime
      player.velocity.y += Math.sin(player.rotation) * boostPower * deltaTime
      player.energy -= 20
      player.boostCooldown = 1

      this.addBoostParticles(player)
    }

    // Shooting
    if (this.mouse.pressed) {
      this.handleShooting()
    }

    // Update rotation to face mouse
    const dx = this.mouse.x - player.position.x
    const dy = this.mouse.y - player.position.y
    player.rotation = Math.atan2(dy, dx)
  }

  /**
   * Handles the player shooting mechanic when mouse is pressed.
   * Creates projectiles, applies cooldown, consumes energy, and generates visual effects.
   */
  private handleShooting() {
    const player = this.players.get(this.localPlayerId)
    if (!player || player.weaponCooldown > 0 || player.energy < 10) return

    const projectile: Projectile = {
      id: `projectile_${Date.now()}_${Math.random()}`,
      position: { ...player.position },
      velocity: {
        x: Math.cos(player.rotation) * 400,
        y: Math.sin(player.rotation) * 400,
      },
      rotation: player.rotation,
      health: 1,
      maxHealth: 1,
      ownerId: player.playerId,
      damage: 25,
      lifetime: 3,
      active: true,
    }

    this.projectiles.push(projectile)
    player.weaponCooldown = 0.2
    player.energy -= 10

    // Add muzzle flash particles
    this.addMuzzleFlashParticles(player)
  }

  /**
   * Updates all projectiles in the game, handling movement, lifetime, and boundary checks.
   * Removes projectiles that have expired or gone out of bounds.
   * 
   * @param deltaTime Time elapsed since the last frame in seconds
   */
  private updateProjectiles(deltaTime: number) {
    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.position.x += projectile.velocity.x * deltaTime
      projectile.position.y += projectile.velocity.y * deltaTime
      projectile.lifetime -= deltaTime

      // Remove if out of bounds or expired
      if (
        projectile.lifetime <= 0 ||
        projectile.position.x < 0 ||
        projectile.position.x > this.canvas.width ||
        projectile.position.y < 0 ||
        projectile.position.y > this.canvas.height
      ) {
        return false
      }

      return true
    })
  }

  private updatePowerUps(deltaTime: number) {
    this.powerUps.forEach((powerUp) => {
      if (!powerUp.active && powerUp.respawnTime > 0) {
        powerUp.respawnTime -= deltaTime
        if (powerUp.respawnTime <= 0) {
          powerUp.active = true
          powerUp.position = {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
          }
        }
      }

      // Floating animation
      powerUp.rotation += deltaTime * 2
    })
  }

  private updateAsteroids(deltaTime: number) {
    this.asteroids.forEach((asteroid) => {
      asteroid.position.x += asteroid.velocity.x * deltaTime * 60
      asteroid.position.y += asteroid.velocity.y * deltaTime * 60
      asteroid.rotation += asteroid.rotationSpeed

      // Wrap around screen
      if (asteroid.position.x < -asteroid.size) asteroid.position.x = this.canvas.width + asteroid.size
      if (asteroid.position.x > this.canvas.width + asteroid.size) asteroid.position.x = -asteroid.size
      if (asteroid.position.y < -asteroid.size) asteroid.position.y = this.canvas.height + asteroid.size
      if (asteroid.position.y > this.canvas.height + asteroid.size) asteroid.position.y = -asteroid.size
    })
  }

  private updateParticles(deltaTime: number) {
    this.particles = this.particles.filter((particle) => {
      particle.position.x += particle.velocity.x * deltaTime
      particle.position.y += particle.velocity.y * deltaTime
      particle.life -= deltaTime
      particle.velocity.x *= 0.98
      particle.velocity.y *= 0.98

      return particle.life > 0
    })
  }

  /**
   * Checks for collisions between game objects and handles the results.
   * Detects and handles the following collision types:
   * - Player vs Projectile: Damages players when hit by projectiles
   * - Player vs PowerUp: Applies power-up effects to players
   * - Projectile vs Asteroid: Damages asteroids and potentially destroys them
   */
  private checkCollisions() {
    // Player vs Projectile collisions
    this.players.forEach((player) => {
      this.projectiles.forEach((projectile, pIndex) => {
        if (projectile.ownerId === player.playerId) return

        const distance = this.getDistance(player.position, projectile.position)
        if (distance < 20) {
          this.handlePlayerHit(player, projectile)
          this.projectiles.splice(pIndex, 1)
        }
      })

      // Player vs PowerUp collisions
      this.powerUps.forEach((powerUp) => {
        if (!powerUp.active) return

        const distance = this.getDistance(player.position, powerUp.position)
        if (distance < 25) {
          this.handlePowerUpCollection(player, powerUp)
        }
      })
    })

    // Projectile vs Asteroid collisions
    this.projectiles.forEach((projectile, pIndex) => {
      this.asteroids.forEach((asteroid) => {
        const distance = this.getDistance(projectile.position, asteroid.position)
        if (distance < asteroid.size) {
          this.addExplosionParticles(projectile.position, "orange")
          this.projectiles.splice(pIndex, 1)
        }
      })
    })
  }

  /**
   * Handles damage calculation and effects when a player is hit by a projectile.
   * Applies damage to shields first, then to health, and creates visual hit effects.
   * 
   * @param player The player that was hit
   * @param projectile The projectile that hit the player
   */
  private handlePlayerHit(player: Player, projectile: Projectile) {
    let damage = projectile.damage

    // Shield absorbs damage first
    if (player.shield > 0) {
      const shieldDamage = Math.min(player.shield, damage)
      player.shield -= shieldDamage
      damage -= shieldDamage
    }

    // Remaining damage goes to health
    if (damage > 0) {
      player.health -= damage
    }

    this.addHitParticles(player.position)

    // Check if player is destroyed
    if (player.health <= 0) {
      this.handlePlayerDestroyed(player, projectile.ownerId)
    }
  }

  private handlePlayerDestroyed(player: Player, killerId: string) {
    player.deaths++
    player.health = player.maxHealth
    player.shield = player.maxShield
    player.energy = player.maxEnergy

    // Respawn at random location
    player.position = {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
    }

    // Award kill to killer
    const killer = this.players.get(killerId)
    if (killer) {
      killer.kills++
      killer.score += 100
    }

    this.addExplosionParticles(player.position, "red")
  }

  private handlePowerUpCollection(player: Player, powerUp: PowerUp) {
    switch (powerUp.type) {
      case "health":
        player.health = Math.min(player.maxHealth, player.health + powerUp.value)
        break
      case "shield":
        player.shield = Math.min(player.maxShield, player.shield + powerUp.value)
        break
      case "energy":
        player.energy = Math.min(player.maxEnergy, player.energy + powerUp.value)
        break
      case "weapon":
        player.score += powerUp.value
        break
    }

    powerUp.active = false
    powerUp.respawnTime = 10 + Math.random() * 10

    this.addCollectionParticles(powerUp.position, this.getPowerUpColor(powerUp.type))
  }

  /**
   * Creates engine exhaust particle effects behind a player ship when moving forward.
   * Particles are orange/yellow in color and appear at the back of the ship.
   * 
   * @param player The player object to create particles for
   */
  private addEngineParticles(player: Player) {
    for (let i = 0; i < 3; i++) {
      const particle: Particle = {
        position: {
          x: player.position.x - Math.cos(player.rotation) * 15,
          y: player.position.y - Math.sin(player.rotation) * 15,
        },
        velocity: {
          x: -Math.cos(player.rotation) * 100 + (Math.random() - 0.5) * 50,
          y: -Math.sin(player.rotation) * 100 + (Math.random() - 0.5) * 50,
        },
        color: `hsl(${30 + Math.random() * 30}, 100%, ${50 + Math.random() * 30}%)`,
        life: 0.5,
        maxLife: 0.5,
        size: 2 + Math.random() * 3,
      }
      this.particles.push(particle)
    }
  }

  /**
   * Creates boost effect particles when a player uses the boost ability.
   * Particles are blue in color and radiate outward in all directions.
   * 
   * @param player The player object to create particles for
   */
  private addBoostParticles(player: Player) {
    for (let i = 0; i < 8; i++) {
      const particle: Particle = {
        position: { ...player.position },
        velocity: {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
        },
        color: `hsl(${200 + Math.random() * 60}, 100%, ${60 + Math.random() * 20}%)`,
        life: 0.8,
        maxLife: 0.8,
        size: 3 + Math.random() * 4,
      }
      this.particles.push(particle)
    }
  }

  /**
   * Creates muzzle flash particles when a player fires a weapon.
   * Particles appear at the front of the ship and travel in the direction of fire.
   * 
   * @param player The player object to create particles for
   */
  private addMuzzleFlashParticles(player: Player) {
    for (let i = 0; i < 5; i++) {
      const particle: Particle = {
        position: {
          x: player.position.x + Math.cos(player.rotation) * 20,
          y: player.position.y + Math.sin(player.rotation) * 20,
        },
        velocity: {
          x: Math.cos(player.rotation) * 50 + (Math.random() - 0.5) * 30,
          y: Math.sin(player.rotation) * 50 + (Math.random() - 0.5) * 30,
        },
        color: `hsl(${45 + Math.random() * 15}, 100%, ${80 + Math.random() * 20}%)`,
        life: 0.2,
        maxLife: 0.2,
        size: 2 + Math.random() * 2,
      }
      this.particles.push(particle)
    }
  }

  private addHitParticles(position: Vector2D) {
    for (let i = 0; i < 6; i++) {
      const particle: Particle = {
        position: { ...position },
        velocity: {
          x: (Math.random() - 0.5) * 150,
          y: (Math.random() - 0.5) * 150,
        },
        color: `hsl(0, 100%, ${60 + Math.random() * 30}%)`,
        life: 0.6,
        maxLife: 0.6,
        size: 2 + Math.random() * 3,
      }
      this.particles.push(particle)
    }
  }

  private addExplosionParticles(position: Vector2D, baseColor: string) {
    for (let i = 0; i < 12; i++) {
      const particle: Particle = {
        position: { ...position },
        velocity: {
          x: (Math.random() - 0.5) * 300,
          y: (Math.random() - 0.5) * 300,
        },
        color:
          baseColor === "red"
            ? `hsl(${Math.random() * 30}, 100%, ${60 + Math.random() * 30}%)`
            : `hsl(${30 + Math.random() * 30}, 100%, ${60 + Math.random() * 30}%)`,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 5,
      }
      this.particles.push(particle)
    }
  }

  private addCollectionParticles(position: Vector2D, color: string) {
    for (let i = 0; i < 8; i++) {
      const particle: Particle = {
        position: { ...position },
        velocity: {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
        },
        color,
        life: 0.8,
        maxLife: 0.8,
        size: 2 + Math.random() * 3,
      }
      this.particles.push(particle)
    }
  }

  /**
   * Calculates the Euclidean distance between two points.
   * 
   * @param pos1 First position vector
   * @param pos2 Second position vector
   * @returns The distance between the two points
   */
  private getDistance(pos1: Vector2D, pos2: Vector2D): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getPowerUpColor(type: PowerUp["type"]): string {
    switch (type) {
      case "health":
        return "#ff4444"
      case "shield":
        return "#4444ff"
      case "energy":
        return "#ffff44"
      case "weapon":
        return "#ff44ff"
      default:
        return "#ffffff"
    }
  }

  /**
   * Renders the entire game scene to the canvas.
   * Draws the space background, stars, game objects (asteroids, power-ups, projectiles),
   * particles for visual effects, and player ships.
   */
  render() {
    // Clear canvas with space background
    this.ctx.fillStyle = "#0a0a0f"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw stars
    this.drawStars()

    // Draw asteroids
    this.asteroids.forEach((asteroid) => this.drawAsteroid(asteroid))

    // Draw power-ups
    this.powerUps.forEach((powerUp) => {
      if (powerUp.active) this.drawPowerUp(powerUp)
    })

    // Draw particles
    this.particles.forEach((particle) => this.drawParticle(particle))

    // Draw projectiles
    this.projectiles.forEach((projectile) => this.drawProjectile(projectile))

    // Draw players
    this.players.forEach((player) => this.drawPlayer(player))

    // Draw UI
    this.drawUI()
  }

  /**
   * Draws the starfield background effect on the canvas.
   * Creates a parallax-like star background with varying opacity.
   */
  private drawStars() {
    this.ctx.fillStyle = "#ffffff"
    for (let i = 0; i < 100; i++) {
      const x = (i * 37) % this.canvas.width
      const y = (i * 73) % this.canvas.height
      const size = Math.sin(i) * 0.5 + 0.5
      this.ctx.globalAlpha = size
      this.ctx.fillRect(x, y, 1, 1)
    }
    this.ctx.globalAlpha = 1
  }

  /**
   * Renders a player ship on the canvas with visual indicators for shields and health.
   * The local player's ship is colored differently than other players.
   * 
   * @param player The player object to render
   */
  private drawPlayer(player: Player) {
    this.ctx.save()
    this.ctx.translate(player.position.x, player.position.y)
    this.ctx.rotate(player.rotation)

    // Draw ship
    this.ctx.strokeStyle = player.playerId === this.localPlayerId ? "#00ff00" : "#ff6600"
    this.ctx.fillStyle = player.playerId === this.localPlayerId ? "#004400" : "#440000"
    this.ctx.lineWidth = 2

    this.ctx.beginPath()
    this.ctx.moveTo(15, 0)
    this.ctx.lineTo(-10, -8)
    this.ctx.lineTo(-5, 0)
    this.ctx.lineTo(-10, 8)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()

    // Draw shield if active
    if (player.shield > 0) {
      this.ctx.strokeStyle = `rgba(0, 100, 255, ${(player.shield / player.maxShield) * 0.5})`
      this.ctx.lineWidth = 1
      this.ctx.beginPath()
      this.ctx.arc(0, 0, 25, 0, Math.PI * 2)
      this.ctx.stroke()
    }

    this.ctx.restore()

    // Draw health bar
    this.drawHealthBar(player)
  }

  /**
   * Draws a health and shield status bar above a player's ship.
   * Shows current health as a red bar and shield as a blue bar if active.
   * 
   * @param player The player object whose health bar to render
   */
  private drawHealthBar(player: Player) {
    const barWidth = 30
    const barHeight = 4
    const x = player.position.x - barWidth / 2
    const y = player.position.y - 35

    // Background
    this.ctx.fillStyle = "#333333"
    this.ctx.fillRect(x, y, barWidth, barHeight)

    // Health
    this.ctx.fillStyle = "#ff4444"
    this.ctx.fillRect(x, y, (player.health / player.maxHealth) * barWidth, barHeight)

    // Shield
    if (player.shield > 0) {
      this.ctx.fillStyle = "#4444ff"
      this.ctx.fillRect(x, y - 6, (player.shield / player.maxShield) * barWidth, 2)
    }
  }

  /**
   * Renders a projectile (bullet) on the canvas.
   * 
   * @param projectile The projectile object to render
   */
  private drawProjectile(projectile: Projectile) {
    this.ctx.save()
    this.ctx.translate(projectile.position.x, projectile.position.y)
    this.ctx.rotate(projectile.rotation)

    this.ctx.fillStyle = "#ffff00"
    this.ctx.fillRect(-3, -1, 6, 2)

    this.ctx.restore()
  }

  /**
   * Renders an asteroid with a randomized jagged appearance.
   * Asteroids have varying sizes and rotation speeds.
   * 
   * @param asteroid The asteroid object to render
   */
  private drawAsteroid(asteroid: Asteroid) {
    this.ctx.save()
    this.ctx.translate(asteroid.position.x, asteroid.position.y)
    this.ctx.rotate(asteroid.rotation)

    this.ctx.strokeStyle = "#888888"
    this.ctx.fillStyle = "#333333"
    this.ctx.lineWidth = 1

    this.ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const radius = asteroid.size * (0.8 + Math.sin(i * 2.3) * 0.2)
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      if (i === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    }
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.restore()
  }

  /**
   * Renders a power-up item on the canvas.
   * Different power-up types have unique visual appearances.
   * 
   * @param powerUp The power-up object to render
   */
  private drawPowerUp(powerUp: PowerUp) {
    this.ctx.save()
    this.ctx.translate(powerUp.position.x, powerUp.position.y)
    this.ctx.rotate(powerUp.rotation)

    const color = this.getPowerUpColor(powerUp.type)
    this.ctx.fillStyle = color
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = 2

    // Draw different shapes for different power-up types
    switch (powerUp.type) {
      case "health":
        // Cross shape
        this.ctx.fillRect(-8, -2, 16, 4)
        this.ctx.fillRect(-2, -8, 4, 16)
        break
      case "shield":
        // Diamond shape
        this.ctx.beginPath()
        this.ctx.moveTo(0, -10)
        this.ctx.lineTo(8, 0)
        this.ctx.lineTo(0, 10)
        this.ctx.lineTo(-8, 0)
        this.ctx.closePath()
        this.ctx.fill()
        break
      case "energy":
        // Lightning bolt
        this.ctx.beginPath()
        this.ctx.moveTo(-3, -10)
        this.ctx.lineTo(3, -2)
        this.ctx.lineTo(-1, -2)
        this.ctx.lineTo(3, 10)
        this.ctx.lineTo(-3, 2)
        this.ctx.lineTo(1, 2)
        this.ctx.closePath()
        this.ctx.fill()
        break
      case "weapon":
        // Star shape
        this.ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
          const x = Math.cos(angle) * 8
          const y = Math.sin(angle) * 8
          if (i === 0) this.ctx.moveTo(x, y)
          else this.ctx.lineTo(x, y)

          const innerAngle = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2
          const innerX = Math.cos(innerAngle) * 4
          const innerY = Math.sin(innerAngle) * 4
          this.ctx.lineTo(innerX, innerY)
        }
        this.ctx.closePath()
        this.ctx.fill()
        break
    }

    this.ctx.restore()
  }

  /**
   * Renders a particle effect on the canvas.
   * Particles fade out over time and vary in color based on their type.
   * 
   * @param particle The particle object to render
   */
  private drawParticle(particle: Particle) {
    const alpha = particle.life / particle.maxLife
    this.ctx.globalAlpha = alpha
    this.ctx.fillStyle = particle.color
    this.ctx.fillRect(
      particle.position.x - particle.size / 2,
      particle.position.y - particle.size / 2,
      particle.size,
      particle.size,
    )
    this.ctx.globalAlpha = 1
  }

  private drawUI() {
    const localPlayer = this.players.get(this.localPlayerId)
    if (!localPlayer) return

    // Draw crosshair
    this.ctx.strokeStyle = "#ffffff"
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.moveTo(this.mouse.x - 10, this.mouse.y)
    this.ctx.lineTo(this.mouse.x + 10, this.mouse.y)
    this.ctx.moveTo(this.mouse.x, this.mouse.y - 10)
    this.ctx.lineTo(this.mouse.x, this.mouse.y + 10)
    this.ctx.stroke()

    // Draw minimap
    this.drawMinimap()
  }

  private drawMinimap() {
    const minimapSize = 120
    const minimapX = this.canvas.width - minimapSize - 10
    const minimapY = 10
    const scaleX = minimapSize / this.canvas.width
    const scaleY = minimapSize / this.canvas.height

    // Background
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    this.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize)
    this.ctx.strokeStyle = "#ffffff"
    this.ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize)

    // Players
    this.players.forEach((player) => {
      const x = minimapX + player.position.x * scaleX
      const y = minimapY + player.position.y * scaleY
      this.ctx.fillStyle = player.playerId === this.localPlayerId ? "#00ff00" : "#ff6600"
      this.ctx.fillRect(x - 2, y - 2, 4, 4)
    })

    // Power-ups
    this.powerUps.forEach((powerUp) => {
      if (!powerUp.active) return
      const x = minimapX + powerUp.position.x * scaleX
      const y = minimapY + powerUp.position.y * scaleY
      this.ctx.fillStyle = this.getPowerUpColor(powerUp.type)
      this.ctx.fillRect(x - 1, y - 1, 2, 2)
    })
  }

  startGame() {
    this.gameTime = 0
    this.lastUpdate = performance.now()
  }

  resetGame() {
    this.players.clear()
    this.projectiles = []
    this.particles = []
    this.gameTime = 0
    this.generatePowerUps()
  }

  isGameFinished(): boolean {
    // Game ends after 5 minutes or when a player reaches 1000 points
    return this.gameTime > 300 || Array.from(this.players.values()).some((p) => p.score >= 1000)
  }

  getGameStats() {
    return {
      players: Array.from(this.players.values()).map((player) => ({
        id: player.playerId,
        name: player.playerId === this.localPlayerId ? "You" : "Opponent",
        score: player.score,
        kills: player.kills,
        deaths: player.deaths,
        health: Math.round(player.health),
        shield: Math.round(player.shield),
        energy: Math.round(player.energy),
      })),
      gameTime: Math.floor(this.gameTime),
      powerUpsCollected: this.powerUps.filter((p) => !p.active).length,
      totalShots: this.projectiles.length,
    }
  }

  handleNetworkUpdate(data: any) {
    // Handle incoming network data from other player
    if (data.type === "playerUpdate" && data.playerId !== this.localPlayerId) {
      const player = this.players.get(data.playerId)
      if (player) {
        player.position = data.position
        player.rotation = data.rotation
        player.health = data.health
        player.shield = data.shield
        player.energy = data.energy
      }
    }
  }

  private sendNetworkUpdate() {
    const localPlayer = this.players.get(this.localPlayerId)
    if (!localPlayer || !this.networkUpdateCallback) return

    this.networkUpdateCallback({
      type: "playerUpdate",
      playerId: this.localPlayerId,
      position: localPlayer.position,
      rotation: localPlayer.rotation,
      health: localPlayer.health,
      shield: localPlayer.shield,
      energy: localPlayer.energy,
    })
  }

  setNetworkUpdateCallback(callback: (data: any) => void) {
    this.networkUpdateCallback = callback
  }

  cleanup() {
    window.removeEventListener("keydown", () => {})
    window.removeEventListener("keyup", () => {})
    
    if (this._debugInterval) {
      clearInterval(this._debugInterval);
      this._debugInterval = null;
    }
  }
}
