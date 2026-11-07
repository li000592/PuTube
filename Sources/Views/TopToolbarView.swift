import SwiftUI

struct TopToolbarView: View {
    @ObservedObject var viewModel: WebViewModel
    @Binding var showSettings: Bool
    
    var body: some View {
        HStack(spacing: 16) {
            // Navigation Group
            HStack(spacing: 8) {
                Button(action: { viewModel.goBack() }) {
                    Image(systemName: "chevron.backward")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 36, height: 36)
                        .background(Color(uiColor: .systemFill))
                        .clipShape(Circle())
                }
                .disabled(!viewModel.canGoBack)
                .opacity(viewModel.canGoBack ? 1.0 : 0.4)
                
                Button(action: { viewModel.goForward() }) {
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 36, height: 36)
                        .background(Color(uiColor: .systemFill))
                        .clipShape(Circle())
                }
                .disabled(!viewModel.canGoForward)
                .opacity(viewModel.canGoForward ? 1.0 : 0.4)
                
                Button(action: { viewModel.reload() }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 15, weight: .medium))
                        .frame(width: 36, height: 36)
                        .background(Color(uiColor: .systemFill))
                        .clipShape(Circle())
                }
                
                Button(action: { viewModel.goHome() }) {
                    Image(systemName: "house.fill")
                        .font(.system(size: 15, weight: .medium))
                        .frame(width: 36, height: 36)
                        .background(Color(uiColor: .systemFill))
                        .clipShape(Circle())
                }
            }
            
            Spacer()
            
            // Center Brand & Ad Shield Status
            HStack(spacing: 8) {
                Image(systemName: "play.rectangle.fill")
                    .foregroundColor(.red)
                    .font(.system(size: 18))
                
                Text("PureTube")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                
                HStack(spacing: 4) {
                    Image(systemName: "shield.checkered")
                        .foregroundColor(.green)
                        .font(.system(size: 13, weight: .bold))
                    
                    Text("\(viewModel.blockedCount) Blocked")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.primary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.15))
                .clipShape(Capsule())
            }
            
            Spacer()
            
            // Action Group (PiP, Zen Mode, Settings)
            HStack(spacing: 10) {
                // Picture-in-Picture Button
                Button(action: { viewModel.requestPiP() }) {
                    HStack(spacing: 6) {
                        Image(systemName: "pip.enter")
                            .font(.system(size: 14, weight: .semibold))
                        Text("PiP")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(uiColor: .systemFill))
                    .clipShape(Capsule())
                }
                .help("Picture in Picture")
                
                // Native Fullscreen Video Button
                Button(action: { viewModel.requestFullscreen() }) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 15, weight: .medium))
                        .frame(width: 36, height: 36)
                        .background(Color(uiColor: .systemFill))
                        .clipShape(Circle())
                }
                .help("Enter Fullscreen Video")
                
                // Settings Button
                Button(action: { showSettings = true }) {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 15, weight: .medium))
                        .frame(width: 36, height: 36)
                        .background(Color(uiColor: .systemFill))
                        .clipShape(Circle())
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.regularMaterial)
    }
}
