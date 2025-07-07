interface BluetoothManagerOptions {
  onConnectionStateChange: (state: "disconnected" | "connecting" | "connected") => void
  onGameDataReceived: (data: any) => void
  onError: (error: string) => void
}

export class BluetoothManager {
  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private service: BluetoothRemoteGATTService | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private options: BluetoothManagerOptions

  private readonly SERVICE_UUID = "12345678-1234-1234-1234-123456789abc"
  private readonly CHARACTERISTIC_UUID = "87654321-4321-4321-4321-cba987654321"

  constructor(options: BluetoothManagerOptions) {
    this.options = options
  }

  async startAsHost(): Promise<string> {
    try {
      this.options.onConnectionStateChange("connecting")

      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth is not supported in this browser")
      }

      // Request device
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID],
      })

      // Set up disconnect handler
      this.device.addEventListener("gattserverdisconnected", () => {
        this.options.onConnectionStateChange("disconnected")
      })

      // Connect to GATT server
      this.server = await this.device.gatt!.connect()

      // In a real implementation, you would set up a GATT server here
      // For demo purposes, we'll simulate the connection
      this.simulateConnection()

      const hostId = `host_${Date.now()}`
      this.options.onConnectionStateChange("connected")

      return hostId
    } catch (error) {
      this.options.onConnectionStateChange("disconnected")
      throw error
    }
  }

  async joinGame(): Promise<string> {
    try {
      this.options.onConnectionStateChange("connecting")

      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth is not supported in this browser")
      }

      // Request device
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID],
      })

      // Set up disconnect handler
      this.device.addEventListener("gattserverdisconnected", () => {
        this.options.onConnectionStateChange("disconnected")
      })

      // Connect to GATT server
      this.server = await this.device.gatt!.connect()

      // In a real implementation, you would connect to an existing GATT server
      // For demo purposes, we'll simulate the connection
      this.simulateConnection()

      const clientId = `client_${Date.now()}`
      this.options.onConnectionStateChange("connected")

      return clientId
    } catch (error) {
      this.options.onConnectionStateChange("disconnected")
      throw error
    }
  }

  private simulateConnection() {
    // Simulate receiving game data periodically
    setInterval(() => {
      if (this.device?.gatt?.connected) {
        // Simulate network data
        this.options.onGameDataReceived({
          type: "ping",
          timestamp: Date.now(),
        })
      }
    }, 1000)
  }

  async sendGameData(data: any): Promise<void> {
    if (!this.characteristic) {
      console.warn("No characteristic available for sending data")
      return
    }

    try {
      const message = JSON.stringify(data)
      const encoder = new TextEncoder()
      await this.characteristic.writeValue(encoder.encode(message))
    } catch (error) {
      this.options.onError("Failed to send game data")
      console.error("Send error:", error)
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect()
    }

    this.device = null
    this.server = null
    this.service = null
    this.characteristic = null
    this.options.onConnectionStateChange("disconnected")
  }

  isConnected(): boolean {
    return this.device?.gatt?.connected ?? false
  }
}
