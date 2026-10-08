from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
base=Path(__file__).resolve().parent.parent
folder=base/'public'/'dify'
with ZipFile(folder/'workroom-dify-templates.zip','w',ZIP_DEFLATED) as archive:
    for path in sorted((base/'dify').iterdir()):
        if path.is_file(): archive.write(path, 'workroom-dify/'+path.name)
    archive.write(base/'docs'/'DIFY_SETUP.md', 'workroom-dify/连接说明.md')
print('Created downloadable template bundle.')
