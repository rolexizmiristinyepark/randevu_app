"""
py2app setup script for WhatsApp Sender
macOS .app bundle oluşturur

Kullanım:
    python3 setup.py py2app
"""

from setuptools import setup

APP = ['whatsapp_sender.py']
DATA_FILES = []
OPTIONS = {
    'argv_emulation': False,  # Terminal'de çalışsın
    'packages': ['pyautogui'],
    'includes': ['urllib.request', 'urllib.parse', 'json', 'subprocess', 'time', 'sys'],
    'excludes': ['mouseinfo', 'rubicon', 'rubicon-objc', 'test', 'unittest', 'distutils', 'setuptools'],
    'site_packages': True,  # Site packages kullan
    'plist': {
        'CFBundleName': 'WhatsApp Hatırlatıcı',
        'CFBundleDisplayName': 'WhatsApp Hatırlatıcı',
        'CFBundleIdentifier': 'com.rolex.whatsapp-sender',
        'CFBundleVersion': '1.0.0',
        'CFBundleShortVersionString': '1.0.0',
        'LSMinimumSystemVersion': '10.13',
        'NSAppleScriptEnabled': True,
        'NSRequiresAquaSystemAppearance': False,
    },
}

setup(
    app=APP,
    name='WhatsApp Hatırlatıcı',
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
