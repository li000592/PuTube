import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = WebViewModel()
    @State private var showSettings = false
    
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Top Toolbar (hidden in Zen Mode)
                if !viewModel.isZenMode {
                    TopToolbarView(viewModel: viewModel, showSettings: $showSettings)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    
                    // Loading Progress Bar
                    if viewModel.isLoading && viewModel.estimatedProgress < 1.0 {
                        ProgressView(value: viewModel.estimatedProgress, total: 1.0)
                            .progressViewStyle(LinearProgressViewStyle(tint: .red))
                            .frame(height: 2)
                    }
                }
                
                // YouTube Web Content
                YouTubeWebView(viewModel: viewModel)
                    .ignoresSafeArea(.all, edges: viewModel.isZenMode ? .all : .bottom)
            }
            
            // Zen Mode Floating Restore Button
            if viewModel.isZenMode {
                VStack {
                    HStack {
                        Spacer()
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.25)) {
                                viewModel.isZenMode = false
                            }
                        }) {
                            Image(systemName: "arrow.down.right.and.arrow.up.left")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(10)
                                .background(Color.black.opacity(0.6))
                                .clipShape(Circle())
                        }
                        .padding(.top, 16)
                        .padding(.trailing, 16)
                    }
                    Spacer()
                }
                .transition(.opacity)
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(viewModel: viewModel)
        }
        // iPad Hardware Keyboard Shortcuts
        .background(
            Group {
                Button("") { viewModel.goBack() }
                    .keyboardShortcut("[", modifiers: .command)
                Button("") { viewModel.goForward() }
                    .keyboardShortcut("]", modifiers: .command)
                Button("") { viewModel.reload() }
                    .keyboardShortcut("r", modifiers: .command)
                Button("") { viewModel.togglePlay() }
                    .keyboardShortcut(.space, modifiers: [])
                Button("") { viewModel.seek(delta: -10) }
                    .keyboardShortcut("j", modifiers: [])
                Button("") { viewModel.seek(delta: 10) }
                    .keyboardShortcut("l", modifiers: [])
                Button("") { viewModel.seek(delta: -5) }
                    .keyboardShortcut(.leftArrow, modifiers: [])
                Button("") { viewModel.seek(delta: 5) }
                    .keyboardShortcut(.rightArrow, modifiers: [])
                Button("") { viewModel.requestFullscreen() }
                    .keyboardShortcut("f", modifiers: [])
                    .keyboardShortcut(.rightArrow, modifiers: [])
            }
            .opacity(0)
        )
    }
}
