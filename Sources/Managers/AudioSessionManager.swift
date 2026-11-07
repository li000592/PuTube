import Foundation
import AVFoundation

final class AudioSessionManager {
    static let shared = AudioSessionManager()
    
    private init() {}
    
    func configure() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playback,
                mode: .moviePlayback,
                options: [.allowAirPlay, .allowBluetoothA2DP]
            )
            try session.setActive(true, options: [])
            print("[AudioSessionManager] Configured AVAudioSession for background playback.")
        } catch {
            print("[AudioSessionManager] Failed to set AVAudioSession category: \(error)")
        }
    }
}
