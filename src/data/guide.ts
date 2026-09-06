export interface GuideSection {
  id: string;
  title: string;
  intro: string;
  badge?: string;
  steps: string[];
  notes?: string[];
}

export interface GuideCopy {
  languageName: string;
  pageTitle: string;
  pageDescription: string;
  kicker: string;
  intro: string;
  contentsTitle: string;
  contentsHint: string;
  stepLabel: string;
  noteLabel: string;
  widgetCaption: string;
  backToTop: string;
  sections: GuideSection[];
}

export const guide: Record<'en' | 'vi', GuideCopy> = {
  en: {
    languageName: 'English',
    pageTitle: 'How to use Loggoo',
    pageDescription: 'A simple iPhone guide to capturing moments, tracking moods, making frames, using widgets, and keeping your journal safe.',
    kicker: 'LOGGOO FOR IPHONE',
    intro: 'Loggoo is a private, offline-first micro-journal. Save a photo, a short Plus video, a mood, or one sentence whenever something feels worth keeping. This guide takes you through every current iOS feature.',
    contentsTitle: 'In this guide',
    contentsHint: 'Start at the beginning or jump straight to what you need.',
    stepLabel: 'Step',
    noteLabel: 'Good to know',
    widgetCaption: 'Add a Loggoo widget, browse the Day, Mood, and Streak styles, then use its shortcuts to open the app.',
    backToTop: 'Back to top',
    sections: [
      {
        id: 'getting-started',
        title: '1. Get started',
        intro: 'The three-page welcome introduces moods, the daily timeline, and frames. It appears only on your first launch unless you choose to replay it later.',
        steps: [
          'Open Loggoo and answer “how do you feel about today?” if you want to preview a mood. This choice does not add anything to your journal.',
          'Tap “continue” or swipe to learn how moments collect into one day.',
          'On the last page, tap “start my first day”. You can also tap “skip for now” at any point.',
          'On Home, use the day view for today’s timeline and the month view for your calendar.'
        ],
        notes: ['To see the welcome again, open Settings and tap “show onboarding again”.']
      },
      {
        id: 'capture',
        title: '2. Capture a photo or video',
        intro: 'The camera is the fastest way to add a moment. Photos are available to everyone; short video capture requires Loggoo Plus and supported hardware.',
        badge: 'VIDEO · LOGGOO PLUS',
        steps: [
          'From Home, tap the camera button or “take a photo”. Allow camera access when iOS asks.',
          'Tap the preview to focus, pinch to zoom, use the flash control, or switch between the front and back cameras.',
          'Tap the shutter for a photo. With Loggoo Plus, press and hold the shutter to record a short video, then release to stop.',
          'You can also tap the photo-library button to choose existing pictures. Select up to the limit shown on screen.',
          'Review the result. Tap “Retake” if needed, or continue to the composer.',
          'Optionally add a short note and choose a mood, then tap “save moment”.'
        ],
        notes: [
          'If a video cannot be recorded, Loggoo keeps the normal photo action available.',
          'Your draft stays on screen if saving fails, so you can try again.'
        ]
      },
      {
        id: 'moods-notes',
        title: '3. Add a mood or note',
        intro: 'A day does not need a photo. A mood or one sentence is enough to keep it from disappearing.',
        steps: [
          'On Home, tap the mood button or “log a mood”.',
          'Choose the face that fits: radiant, happy, calm, normal, down, or off. Loggoo adds it to the selected day immediately.',
          'To write instead, tap the note button or “write a note”.',
          'Enter up to the limit shown by the counter, optionally choose a mood, then tap “add to today”.',
          'When viewing an older day, the button reads “add to this day” and the new item stays on that date.'
        ],
        notes: ['Adding something to an older day fills its timeline and calendar cell, but it does not extend your current streak.']
      },
      {
        id: 'timeline',
        title: '4. Browse and edit your timeline',
        intro: 'Every photo, video, mood, and note appears in time order on the day timeline.',
        steps: [
          'Tap a photo or video card to open its detail view. Play or mute a video from its controls.',
          'In detail view, tap “save” to copy a photo to Apple Photos, or tap “frame this day” to open Frame Studio.',
          'Press and hold any timeline card to edit it.',
          'Move the moment by 15 minutes, choose a time-of-day shortcut, or tap the time field to set an exact time.',
          'Change its note or mood when those fields are available, then tap “save changes”.',
          'To delete it, tap “remove this moment” and confirm. Removing a moment cannot be undone.'
        ],
        notes: ['Mood-only entries have no note field, and their mood cannot be cleared because the mood is the whole entry.']
      },
      {
        id: 'calendar',
        title: '5. Move between days and months',
        intro: 'Use the date controls to revisit earlier days or understand your month at a glance.',
        steps: [
          'In day view, tap the left or right arrow beside the date to move one day at a time.',
          'Switch from “day” to “month” to open the calendar.',
          'Tap any date to open that day. Swipe the month view to move between months.',
          'Use the month summary to see days logged, photos saved, and frames made.',
          'Tap the streak chip to see your current run and the days already completed this week.'
        ],
        notes: ['Your “week starts” preference changes the week layout in the calendar, streaks, trends, and recaps.']
      },
      {
        id: 'frames',
        title: '6. Make and share a frame',
        intro: 'Frame Studio turns one day into a single image for Stories, posts, or your photo library.',
        badge: 'SOME LAYOUTS · LOGGOO PLUS',
        steps: [
          'Open a day with at least one photo, then tap “frame your day”. You can also use “frame this day” from a moment.',
          'Choose 9:16 for a Story or 4:5 for a post.',
          'Swipe through the template rail and tap a layout to preview it. Crown-marked layouts need Loggoo Plus to save or share.',
          'Tap “photos” to choose which pictures appear. “auto pick” lets Loggoo choose again for you.',
          'Tap “mood” to override the day’s mood for this frame, or choose “auto” to follow your logs.',
          'Tap “save” to add the finished image to Apple Photos, or “share” to open the iOS share sheet.'
        ],
        notes: ['Exports are rendered at full resolution. If a save fails, check Photos access in iOS Settings and try again.']
      },
      {
        id: 'insights-recaps',
        title: '7. View Mood Trends and Recap',
        intro: 'Trends explains patterns in your moods. Recap plays your journal back as a private, on-device story.',
        badge: 'MOOD TRENDS · LOGGOO PLUS',
        steps: [
          'Tap the chart button on Home to open “mood trends”. Switch between week and month.',
          'Review your average mood, change from the previous period, mood split, memorable days, observations, and suggested next step.',
          'To watch a Recap, tap “your week as a story” when its banner appears on Home.',
          'Choose a week, month, or year window and a 15, 20, 30, 45, or 60 second length. Unavailable lengths need more moments.',
          'Tap “play”. Tap the right side to move forward, the left side to go back, or press and hold to pause.',
          'At the end, tap “play again” to return to the setup.'
        ],
        notes: [
          'Trend calculations and Recap playback stay on your device.',
          'Recap video export is not available yet.'
        ]
      },
      {
        id: 'widgets',
        title: '8. Add a Home Screen Widget',
        intro: 'Loggoo has Day, Mood, and Streak widgets. They show your latest journal snapshot and open the app when you tap an action.',
        badge: 'LOGGOO PLUS',
        steps: [
          'Touch and hold an empty area of the iPhone Home Screen until the apps begin to move.',
          'Tap “Edit”, then “Add Widget”. On some iOS versions, tap the plus button instead.',
          'Search for “Loggoo” and select it.',
          'Swipe through Day, Mood, and Streak and their available sizes.',
          'Tap “Add Widget”, move it where you want, then tap “Done”.',
          'On supported larger sizes, tap “photo”, “note”, or “mood” to open that surface in Loggoo. Small widgets open the app without inline actions.'
        ],
        notes: [
          'Widgets are launchers, not editors: a mood or note is saved only after you finish inside Loggoo.',
          'If a widget stays locked or stale after activating Plus, open Loggoo once so it can publish a fresh snapshot.'
        ]
      },
      {
        id: 'reminders',
        title: '9. Set a daily reminder',
        intro: 'Choose one gentle daily check-in time. Loggoo may also remind you about an empty evening or an older memory when notifications are enabled.',
        steps: [
          'Tap the gear on Home to open Settings.',
          'Turn on “notifications” if you want Loggoo to mention an evening that is still empty or a memory from this day in an earlier month or year.',
          'Tap “daily reminder”, choose a time in “pick a reminder time”, then tap “set”. This fixed-time reminder has its own switch.',
          'Allow notifications when iOS asks. The Settings row now shows the scheduled time.',
          'Tap the row again to change the time, or turn its switch off to stop the daily reminder.',
          'You can also accept “one nudge a day?” after your first log and choose the time without leaving Home.'
        ],
        notes: ['If access is off, tap “open settings”, enable notifications for Loggoo in iOS Settings, then return and try again.']
      },
      {
        id: 'settings',
        title: '10. Personalize Loggoo',
        intro: 'Settings controls how the journal looks, feels, and labels time throughout the app.',
        badge: 'SOME OPTIONS · LOGGOO PLUS',
        steps: [
          'Tap the gear on Home to open Settings, then tap the album card to rename “my loggoo”. This name appears on frames and exports.',
          'Tap “mood faces” to preview all 15 packs. Classic is free; the other packs require Plus and update faces and mood colors across the app and widgets.',
          'Tap “default frame” to choose the layout Frame Studio opens with. Locked defaults require Plus.',
          'Tap “time format” to switch between 12-hour and 24-hour clocks.',
          'Tap “week starts” to switch between Monday and Sunday.',
          'Use “haptics” to turn Loggoo’s confirmation taps on or off.',
          'Use the About rows to visit the website, read the legal pages, follow Loggoo, or rate the app.'
        ],
        notes: ['Changing a mood-face pack also changes faces in previously logged days because it is an appearance preference, not journal data.']
      },
      {
        id: 'icloud-plus',
        title: '11. iCloud sync and Loggoo Plus',
        intro: 'Plus unlocks video logging, premium frames and mood packs, Mood Trends, widgets, and iCloud sync.',
        badge: 'LOGGOO PLUS',
        steps: [
          'Tap the “loggoo plus” card in Settings to view the plans available for your App Store account.',
          'Choose a plan and follow the App Store purchase sheet. Prices and renewal terms shown there come from Apple.',
          'If you already purchased Plus with the same Apple ID, open the paywall and tap “restore”.',
          'To sync, open Settings and tap “sync with icloud”, then turn it on.',
          'Check the status in the iCloud sheet. Tap “sync now” when you want to request an immediate refresh.',
          'Enable sync on your other Apple device while signed in to the intended iCloud account.'
        ],
        notes: [
          'Your photos, moods, and notes stay in your own iCloud account; Loggoo does not keep a separate copy.',
          'If the Apple ID changes, sync pauses until you turn it on again and confirm the new account.'
        ]
      },
      {
        id: 'troubleshooting',
        title: '12. Troubleshooting and privacy',
        intro: 'Most problems come from an iOS permission, a missing local media file, or a store/iCloud connection.',
        steps: [
          'Camera unavailable: open iOS Settings › Apps › Loggoo › Camera and enable access, then return and tap “Retry camera”.',
          'Cannot choose or save photos: check Loggoo’s Photos permission in iOS Settings and try again.',
          'No notifications: enable Allow Notifications for Loggoo, then confirm your reminder time inside the app.',
          'Plus not recognized: confirm the correct Apple ID, connect to the internet, then tap “restore” on the paywall.',
          'iCloud paused: make sure iCloud Drive is on, check the Apple ID shown by iOS, then return to Loggoo and use “sync now”.',
          'A photo says it is no longer on this device: the timeline record still exists, but the private media file is missing and cannot be displayed.',
          'Before deleting a moment, remember that “remove” is permanent. Save or share anything you want to keep first.'
        ],
        notes: [
          'By default, journal data and media are stored privately on the device. They are not automatically added to Apple Photos.',
          'Mood Trends and Recap are calculated locally. When iCloud sync is enabled, journal content travels through your private iCloud database.'
        ]
      }
    ]
  },
  vi: {
    languageName: 'Tiếng Việt',
    pageTitle: 'Hướng dẫn sử dụng Loggoo',
    pageDescription: 'Hướng dẫn đơn giản trên iPhone để ghi lại khoảnh khắc, theo dõi tâm trạng, tạo frame, dùng widget và bảo vệ nhật ký.',
    kicker: 'LOGGOO TRÊN IPHONE',
    intro: 'Loggoo là ứng dụng micro-journal riêng tư, ưu tiên hoạt động ngoại tuyến. Bạn có thể lưu một bức ảnh, video ngắn dành cho Plus, tâm trạng hoặc một câu ghi chú bất cứ khi nào có điều đáng nhớ. Hướng dẫn này bao gồm toàn bộ tính năng iOS hiện có.',
    contentsTitle: 'Nội dung hướng dẫn',
    contentsHint: 'Bắt đầu từ đầu hoặc chuyển thẳng đến mục bạn cần.',
    stepLabel: 'Bước',
    noteLabel: 'Thông tin hữu ích',
    widgetCaption: 'Thêm widget Loggoo, xem các kiểu Day, Mood và Streak, sau đó dùng phím tắt để mở đúng chức năng trong app.',
    backToTop: 'Về đầu trang',
    sections: [
      {
        id: 'getting-started',
        title: '1. Bắt đầu sử dụng',
        intro: 'Ba trang chào mừng giới thiệu tâm trạng, timeline hằng ngày và frame. Phần này chỉ xuất hiện ở lần mở đầu tiên, trừ khi bạn chọn xem lại sau đó.',
        steps: [
          'Mở Loggoo và trả lời “how do you feel about today?” nếu bạn muốn xem thử một tâm trạng. Lựa chọn này không thêm dữ liệu vào nhật ký.',
          'Nhấn “continue” hoặc vuốt để xem cách các khoảnh khắc được gom lại theo từng ngày.',
          'Ở trang cuối, nhấn “start my first day”. Bạn cũng có thể nhấn “skip for now” ở bất kỳ bước nào.',
          'Tại Home, dùng chế độ day để xem timeline hôm nay và month để xem lịch.'
        ],
        notes: ['Muốn xem lại phần giới thiệu, mở Settings và chọn “show onboarding again”.']
      },
      {
        id: 'capture',
        title: '2. Chụp ảnh hoặc quay video',
        intro: 'Camera là cách nhanh nhất để thêm một khoảnh khắc. Mọi người đều có thể chụp ảnh; quay video ngắn cần Loggoo Plus và thiết bị được hỗ trợ.',
        badge: 'VIDEO · LOGGOO PLUS',
        steps: [
          'Từ Home, nhấn nút camera hoặc “take a photo”. Cho phép truy cập camera khi iOS hỏi.',
          'Chạm vào khung xem trước để lấy nét, chụm hai ngón để zoom, chỉnh flash hoặc đổi camera trước/sau.',
          'Chạm nút chụp để chụp ảnh. Với Loggoo Plus, nhấn giữ nút chụp để quay video ngắn rồi thả tay để dừng.',
          'Bạn cũng có thể nhấn nút thư viện ảnh để chọn ảnh có sẵn. Chọn tối đa số lượng hiển thị trên màn hình.',
          'Kiểm tra kết quả. Nhấn “Retake” nếu muốn làm lại hoặc tiếp tục đến màn hình soạn nội dung.',
          'Thêm ghi chú ngắn và chọn tâm trạng nếu muốn, sau đó nhấn “save moment”.'
        ],
        notes: [
          'Nếu thiết bị không thể quay video, thao tác chụp ảnh thông thường vẫn dùng được.',
          'Nếu lưu thất bại, bản nháp vẫn ở trên màn hình để bạn thử lại.'
        ]
      },
      {
        id: 'moods-notes',
        title: '3. Thêm tâm trạng hoặc ghi chú',
        intro: 'Một ngày không nhất thiết phải có ảnh. Chỉ một tâm trạng hoặc một câu cũng đủ để lưu lại ngày đó.',
        steps: [
          'Tại Home, nhấn nút mood hoặc “log a mood”.',
          'Chọn gương mặt phù hợp: radiant, happy, calm, normal, down hoặc off. Loggoo sẽ thêm tâm trạng ngay vào ngày đang xem.',
          'Nếu muốn viết, nhấn nút note hoặc “write a note”.',
          'Nhập nội dung trong giới hạn bộ đếm, chọn thêm tâm trạng nếu muốn rồi nhấn “add to today”.',
          'Khi đang xem một ngày cũ, nút sẽ là “add to this day” và nội dung mới nằm đúng ngày đó.'
        ],
        notes: ['Thêm nội dung vào ngày cũ sẽ lấp timeline và ô lịch của ngày đó nhưng không kéo dài streak hiện tại.']
      },
      {
        id: 'timeline',
        title: '4. Xem và chỉnh sửa timeline',
        intro: 'Mọi ảnh, video, tâm trạng và ghi chú được sắp theo thời gian trên timeline của ngày.',
        steps: [
          'Chạm vào thẻ ảnh hoặc video để mở trang chi tiết. Dùng các nút điều khiển để phát hoặc tắt tiếng video.',
          'Trong trang chi tiết, nhấn “save” để lưu ảnh vào Apple Photos hoặc “frame this day” để mở Frame Studio.',
          'Nhấn giữ bất kỳ thẻ nào trên timeline để chỉnh sửa.',
          'Dời thời gian 15 phút, chọn nhanh buổi trong ngày hoặc chạm trường thời gian để đặt giờ chính xác.',
          'Đổi ghi chú hoặc tâm trạng khi các trường đó xuất hiện, sau đó nhấn “save changes”.',
          'Muốn xoá, nhấn “remove this moment” rồi xác nhận. Khoảnh khắc đã xoá không thể khôi phục.'
        ],
        notes: ['Mục chỉ có tâm trạng sẽ không có trường ghi chú và không thể bỏ trống tâm trạng vì đó là toàn bộ nội dung của mục.']
      },
      {
        id: 'calendar',
        title: '5. Chuyển ngày và tháng',
        intro: 'Dùng các nút ngày để xem lại nhật ký cũ hoặc quan sát cả tháng.',
        steps: [
          'Trong chế độ day, nhấn mũi tên trái hoặc phải cạnh ngày để di chuyển từng ngày.',
          'Chuyển từ “day” sang “month” để mở lịch.',
          'Chạm vào một ngày để mở timeline của ngày đó. Vuốt lịch để đổi tháng.',
          'Xem phần tổng kết tháng để biết số ngày đã ghi, số ảnh và số frame đã tạo.',
          'Nhấn chip streak để xem chuỗi ngày hiện tại và những ngày đã hoàn thành trong tuần.'
        ],
        notes: ['Tuỳ chọn “week starts” thay đổi cách xếp tuần trong lịch, streak, Mood Trends và Recap.']
      },
      {
        id: 'frames',
        title: '6. Tạo và chia sẻ frame',
        intro: 'Frame Studio biến một ngày thành một ảnh duy nhất để đăng Story, bài viết hoặc lưu vào thư viện.',
        badge: 'MỘT SỐ LAYOUT · LOGGOO PLUS',
        steps: [
          'Mở ngày có ít nhất một ảnh rồi nhấn “frame your day”. Bạn cũng có thể chọn “frame this day” từ một khoảnh khắc.',
          'Chọn 9:16 cho Story hoặc 4:5 cho bài đăng.',
          'Vuốt thanh template và chạm một layout để xem trước. Layout có biểu tượng vương miện cần Loggoo Plus để lưu hoặc chia sẻ.',
          'Nhấn “photos” để chọn ảnh xuất hiện. “auto pick” cho phép Loggoo chọn lại tự động.',
          'Nhấn “mood” để đặt tâm trạng riêng cho frame hoặc chọn “auto” để dùng tâm trạng từ nhật ký.',
          'Nhấn “save” để lưu ảnh hoàn chỉnh vào Apple Photos hoặc “share” để mở bảng chia sẻ của iOS.'
        ],
        notes: ['Ảnh được xuất ở độ phân giải đầy đủ. Nếu không lưu được, kiểm tra quyền Photos trong iOS Settings rồi thử lại.']
      },
      {
        id: 'insights-recaps',
        title: '7. Xem Mood Trends và Recap',
        intro: 'Mood Trends giúp bạn hiểu các mẫu tâm trạng. Recap phát lại nhật ký dưới dạng story riêng tư ngay trên thiết bị.',
        badge: 'MOOD TRENDS · LOGGOO PLUS',
        steps: [
          'Nhấn nút biểu đồ trên Home để mở “mood trends”. Chuyển giữa week và month.',
          'Xem tâm trạng trung bình, thay đổi so với kỳ trước, tỷ lệ tâm trạng, ngày đáng nhớ, nhận xét và gợi ý tiếp theo.',
          'Muốn xem Recap, nhấn banner “your week as a story” khi banner xuất hiện trên Home.',
          'Chọn khoảng week, month hoặc year và thời lượng 15, 20, 30, 45 hoặc 60 giây. Thời lượng bị khoá cần thêm khoảnh khắc.',
          'Nhấn “play”. Chạm bên phải để đi tiếp, bên trái để quay lại hoặc nhấn giữ để tạm dừng.',
          'Khi kết thúc, nhấn “play again” để trở lại màn hình thiết lập.'
        ],
        notes: [
          'Mood Trends và Recap đều được xử lý trên thiết bị.',
          'Loggoo hiện chưa hỗ trợ xuất Recap thành file video.'
        ]
      },
      {
        id: 'widgets',
        title: '8. Thêm Home Screen Widget',
        intro: 'Loggoo có ba widget Day, Mood và Streak. Widget hiển thị bản chụp nhật ký mới nhất và mở app khi bạn chạm một hành động.',
        badge: 'LOGGOO PLUS',
        steps: [
          'Nhấn giữ vùng trống trên Home Screen của iPhone cho đến khi các ứng dụng rung.',
          'Nhấn “Edit”, sau đó chọn “Add Widget”. Trên một số phiên bản iOS, hãy nhấn nút dấu cộng.',
          'Tìm “Loggoo” và chọn ứng dụng.',
          'Vuốt qua Day, Mood, Streak và các kích thước có sẵn.',
          'Nhấn “Add Widget”, kéo widget đến vị trí mong muốn rồi nhấn “Done”.',
          'Ở các kích thước lớn được hỗ trợ, nhấn “photo”, “note” hoặc “mood” để mở đúng chức năng trong Loggoo. Widget nhỏ chỉ mở app và không có hành động trực tiếp.'
        ],
        notes: [
          'Widget chỉ là lối tắt, không phải trình chỉnh sửa: tâm trạng hoặc ghi chú chỉ được lưu sau khi bạn hoàn tất trong Loggoo.',
          'Nếu widget vẫn bị khoá hoặc chưa cập nhật sau khi kích hoạt Plus, hãy mở Loggoo một lần để app tạo bản chụp mới.'
        ]
      },
      {
        id: 'reminders',
        title: '9. Đặt nhắc nhở hằng ngày',
        intro: 'Chọn một giờ check-in nhẹ nhàng mỗi ngày. Khi bật thông báo, Loggoo cũng có thể nhắc về buổi tối còn trống hoặc một kỷ niệm cũ.',
        steps: [
          'Nhấn biểu tượng bánh răng trên Home để mở Settings.',
          'Bật “notifications” nếu bạn muốn Loggoo nhắc khi buổi tối vẫn chưa có nội dung hoặc gợi lại kỷ niệm cùng ngày ở tháng/năm trước.',
          'Nhấn “daily reminder”, chọn giờ trong “pick a reminder time” rồi nhấn “set”. Lời nhắc cố định này có công tắc riêng.',
          'Cho phép thông báo khi iOS hỏi. Dòng Settings sẽ hiển thị giờ đã đặt.',
          'Nhấn lại dòng này để đổi giờ hoặc tắt công tắc để ngừng nhắc hằng ngày.',
          'Bạn cũng có thể chấp nhận “one nudge a day?” sau lần ghi đầu tiên và chọn giờ ngay từ Home.'
        ],
        notes: ['Nếu quyền đang tắt, nhấn “open settings”, bật thông báo cho Loggoo trong iOS Settings rồi quay lại thử lần nữa.']
      },
      {
        id: 'settings',
        title: '10. Cá nhân hoá Loggoo',
        intro: 'Settings điều khiển giao diện, phản hồi và cách hiển thị thời gian trên toàn ứng dụng.',
        badge: 'MỘT SỐ TUỲ CHỌN · LOGGOO PLUS',
        steps: [
          'Nhấn biểu tượng bánh răng trên Home để mở Settings, sau đó nhấn thẻ album để đổi tên “my loggoo”. Tên này xuất hiện trên frame và ảnh xuất.',
          'Nhấn “mood faces” để xem 15 bộ gương mặt. Classic miễn phí; các bộ còn lại cần Plus và thay đổi gương mặt, màu tâm trạng trong app lẫn widget.',
          'Nhấn “default frame” để chọn layout được mở sẵn trong Frame Studio. Template bị khoá cần Plus.',
          'Nhấn “time format” để đổi giữa đồng hồ 12 giờ và 24 giờ.',
          'Nhấn “week starts” để chọn tuần bắt đầu vào thứ Hai hoặc Chủ nhật.',
          'Dùng “haptics” để bật hoặc tắt phản hồi rung xác nhận của Loggoo.',
          'Dùng các dòng trong About để mở website, đọc điều khoản, theo dõi Loggoo hoặc đánh giá ứng dụng.'
        ],
        notes: ['Đổi mood-face pack cũng thay đổi gương mặt ở các ngày đã ghi trước đó vì đây là cài đặt giao diện, không phải dữ liệu nhật ký.']
      },
      {
        id: 'icloud-plus',
        title: '11. Đồng bộ iCloud và Loggoo Plus',
        intro: 'Plus mở khoá quay video, frame và mood pack cao cấp, Mood Trends, widget và đồng bộ iCloud.',
        badge: 'LOGGOO PLUS',
        steps: [
          'Nhấn thẻ “loggoo plus” trong Settings để xem các gói dành cho tài khoản App Store của bạn.',
          'Chọn gói và làm theo bảng thanh toán của App Store. Giá và điều khoản gia hạn hiển thị tại đó do Apple cung cấp.',
          'Nếu đã mua Plus bằng cùng Apple ID, mở paywall và nhấn “restore”.',
          'Để đồng bộ, mở Settings, nhấn “sync with icloud” rồi bật tính năng.',
          'Kiểm tra trạng thái trong bảng iCloud. Nhấn “sync now” khi muốn yêu cầu cập nhật ngay.',
          'Bật đồng bộ trên thiết bị Apple khác khi đang đăng nhập đúng tài khoản iCloud.'
        ],
        notes: [
          'Ảnh, tâm trạng và ghi chú nằm trong tài khoản iCloud của bạn; Loggoo không giữ một bản sao riêng.',
          'Nếu Apple ID thay đổi, đồng bộ sẽ tạm dừng cho đến khi bạn bật lại và xác nhận tài khoản mới.'
        ]
      },
      {
        id: 'troubleshooting',
        title: '12. Xử lý sự cố và quyền riêng tư',
        intro: 'Phần lớn sự cố đến từ quyền iOS, file media cục bộ bị thiếu hoặc kết nối với App Store/iCloud.',
        steps: [
          'Không mở được camera: vào iOS Settings › Apps › Loggoo › Camera và bật quyền, sau đó quay lại nhấn “Retry camera”.',
          'Không chọn hoặc lưu được ảnh: kiểm tra quyền Photos của Loggoo trong iOS Settings rồi thử lại.',
          'Không có thông báo: bật Allow Notifications cho Loggoo, sau đó xác nhận lại giờ nhắc trong app.',
          'Plus chưa được nhận diện: kiểm tra Apple ID, kết nối internet rồi nhấn “restore” trên paywall.',
          'iCloud bị tạm dừng: bảo đảm iCloud Drive đang bật, kiểm tra Apple ID trong iOS rồi quay lại Loggoo và chọn “sync now”.',
          'Ảnh báo không còn trên thiết bị: bản ghi timeline vẫn còn nhưng file media riêng tư đã mất nên không thể hiển thị.',
          'Trước khi xoá một khoảnh khắc, hãy nhớ “remove” là vĩnh viễn. Lưu hoặc chia sẻ nội dung bạn muốn giữ trước.'
        ],
        notes: [
          'Theo mặc định, dữ liệu và media nhật ký được lưu riêng tư trên thiết bị, không tự động thêm vào Apple Photos.',
          'Mood Trends và Recap được tính cục bộ. Khi bật iCloud sync, nội dung nhật ký đi qua cơ sở dữ liệu iCloud riêng của bạn.'
        ]
      }
    ]
  }
};
