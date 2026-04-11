use std::path::Path;

use base64::{engine::general_purpose, Engine as _};

use super::placeholder::create_placeholder_logo;

pub async fn extract_app_logo(exe_path: &str) -> Option<String> {
    let exe_path = exe_path.to_string();
    tokio::task::spawn_blocking(move || extract_icon_from_exe(&exe_path))
        .await
        .ok()
        .flatten()
}

fn extract_icon_from_exe(exe_path: &str) -> Option<String> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| -> Option<String> {
        unsafe {
            use windows::{
                core::PCWSTR,
                Win32::{
                    Graphics::Gdi::{
                        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject,
                        BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, HDC, HGDIOBJ,
                    },
                    Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES,
                    System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
                    UI::{
                        Controls::IImageList,
                        Shell::{SHGetFileInfoW, SHGetImageList, SHFILEINFOW, SHGFI_SYSICONINDEX},
                        WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL},
                    },
                },
            };

            // SHIL_JUMBO = 4 gives 256×256 icons
            const SHIL_JUMBO: i32 = 0x0004;
            const SIZE: i32 = 256;

            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let wide_path: Vec<u16> = exe_path.encode_utf16().chain(Some(0)).collect();

            let mut shfi: SHFILEINFOW = std::mem::zeroed();
            let ret = SHGetFileInfoW(
                PCWSTR(wide_path.as_ptr()),
                FILE_FLAGS_AND_ATTRIBUTES(0),
                Some(&mut shfi),
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_SYSICONINDEX,
            );
            if ret == 0 {
                CoUninitialize();
                return None;
            }
            let icon_index = shfi.iIcon;

            let image_list: IImageList = match SHGetImageList(SHIL_JUMBO) {
                Ok(il) => il,
                Err(_) => {
                    CoUninitialize();
                    return None;
                }
            };
            let hicon = match image_list.GetIcon(icon_index, 0) {
                Ok(ic) => ic,
                Err(_) => {
                    CoUninitialize();
                    return None;
                }
            };

            let mem_dc = CreateCompatibleDC(HDC(0));
            if mem_dc.0 == 0 {
                let _ = DestroyIcon(hicon);
                CoUninitialize();
                return None;
            }

            let mut bmi: BITMAPINFO = std::mem::zeroed();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bmi.bmiHeader.biWidth = SIZE;
            bmi.bmiHeader.biHeight = -SIZE;
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;

            let mut bits_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
            let hbitmap =
                match CreateDIBSection(mem_dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0) {
                    Ok(bmp) => bmp,
                    Err(_) => {
                        let _ = DeleteDC(mem_dc);
                        let _ = DestroyIcon(hicon);
                        return None;
                    }
                };

            let old = SelectObject(mem_dc, HGDIOBJ(hbitmap.0));
            let draw_ok = DrawIconEx(mem_dc, 0, 0, hicon, SIZE, SIZE, 0, None, DI_NORMAL).is_ok();

            let byte_count = (SIZE * SIZE * 4) as usize;
            let mut pixels: Vec<u8> = if draw_ok && !bits_ptr.is_null() {
                std::slice::from_raw_parts(bits_ptr as *const u8, byte_count).to_vec()
            } else {
                vec![]
            };

            SelectObject(mem_dc, old);
            let _ = DeleteObject(HGDIOBJ(hbitmap.0));
            let _ = DeleteDC(mem_dc);
            let _ = DestroyIcon(hicon);

            if pixels.is_empty() {
                return None;
            }

            // Legacy XOR icons have alpha = 0 everywhere; make them opaque
            let has_alpha = pixels.chunks(4).any(|c| c[3] > 0);

            // Windows stores BGRA; convert to RGBA for the image crate
            for chunk in pixels.chunks_mut(4) {
                let (b, g, r, a) = (chunk[0], chunk[1], chunk[2], chunk[3]);
                chunk[0] = r;
                chunk[1] = g;
                chunk[2] = b;
                chunk[3] = if has_alpha { a } else { 255 };
            }

            use image::{DynamicImage, ImageBuffer, Rgba};
            let img = ImageBuffer::<Rgba<u8>, _>::from_raw(SIZE as u32, SIZE as u32, pixels)?;
            let mut png = Vec::new();
            DynamicImage::ImageRgba8(img)
                .write_to(
                    &mut std::io::Cursor::new(&mut png),
                    image::ImageOutputFormat::Png,
                )
                .ok()?;

            CoUninitialize();
            Some(general_purpose::STANDARD.encode(&png))
        }
    }))
    .ok()
    .flatten()
    .or_else(|| {
        Some(create_placeholder_logo(
            &Path::new(exe_path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy(),
        ))
    })
}
