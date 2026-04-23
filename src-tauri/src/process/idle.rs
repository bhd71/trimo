use windows::Win32::System::SystemInformation::GetTickCount;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

/// Returns `true` when the user has not had any keyboard/mouse input for at least
/// `threshold_minutes` minutes. Returns `false` on any Win32 API failure.
pub fn is_system_idle(threshold_minutes: u64) -> bool {
    if threshold_minutes == 0 {
        return false;
    }

    let threshold_ms = threshold_minutes * 60 * 1000;

    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };

        if GetLastInputInfo(&mut info).as_bool() {
            let tick_now = GetTickCount();
            let elapsed = tick_now.wrapping_sub(info.dwTime);
            elapsed as u64 >= threshold_ms
        } else {
            false
        }
    }
}
