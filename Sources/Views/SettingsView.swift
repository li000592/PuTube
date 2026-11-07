import SwiftUI

struct SettingsView: View {
    @ObservedObject var viewModel: WebViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Experience & Layout")) {
                    Picker("Display Mode", selection: $viewModel.userAgentMode) {
                        ForEach(UserAgentMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: viewModel.userAgentMode) { newMode in
                        viewModel.switchUserAgent(to: newMode)
                    }
                    
                    Text("iPad Desktop layout enables the spacious multi-column grid, higher resolution playback options, and full sidebar controls.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section(header: Text("Shield & Ad Protection")) {
                    HStack {
                        Label("Ads & Trackers Blocked", systemImage: "shield.checkered")
                        Spacer()
                        Text("\(viewModel.blockedCount)")
                            .fontWeight(.bold)
                            .foregroundColor(.green)
                    }
                    
                    HStack {
                        Label("Background Playback", systemImage: "speaker.wave.3.fill")
                        Spacer()
                        Text("Active")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Label("Picture-in-Picture (PiP)", systemImage: "pip.fill")
                        Spacer()
                        Text("Active")
                            .foregroundColor(.secondary)
                    }
                }
                
                Section(header: Text("Storage & Privacy")) {
                    Button(role: .destructive, action: {
                        viewModel.clearBrowsingData()
                        dismiss()
                    }) {
                        Label("Clear Cache & Browsing Data", systemImage: "trash")
                    }
                }
                
                Section(header: Text("Keyboard Shortcuts (iPad)")) {
                    VStack(alignment: .leading, spacing: 6) {
                        shortcutRow("Space", description: "Play / Pause video")
                        shortcutRow("← / →", description: "Seek 5 seconds back / forward")
                        shortcutRow("J / L", description: "Seek 10 seconds back / forward")
                        shortcutRow("M", description: "Mute / Unmute")
                        shortcutRow("F", description: "Toggle fullscreen")
                        shortcutRow("⌘ + R", description: "Reload page")
                        shortcutRow("⌘ + [", description: "Go Back")
                        shortcutRow("⌘ + ]", description: "Go Forward")
                    }
                    .padding(.vertical, 4)
                }
                
                Section(header: Text("About PureTube")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0 (Native for iPad)")
                            .foregroundColor(.secondary)
                    }
                    
                    Text("Built with native Swift, WebKit declarative rules, and intelligent player defusing scripts.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("PureTube Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func shortcutRow(_ key: String, description: String) -> some View {
        HStack {
            Text(key)
                .font(.system(.caption, design: .monospaced))
                .fontWeight(.bold)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color(uiColor: .tertiarySystemFill))
                .cornerRadius(4)
            Text(description)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
        }
    }
}
