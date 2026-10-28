import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'nlp_engine.py'
TEXT = 'Jane Doe\nEducation: University degree\nProjects: Community library\nSkills: Teaching'

class ExtractionTests(unittest.TestCase):
    def extract(self, path):
        result = subprocess.run([sys.executable, str(SCRIPT), '--extract', str(path)], capture_output=True, text=True, timeout=30, check=True)
        return json.loads(result.stdout)

    def test_text_docx_and_pdf(self):
        from docx import Document
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            txt = directory / 'resume.txt'
            txt.write_text(TEXT)
            self.assertEqual(self.extract(txt)['extractedText'], TEXT)
            doc = Document()
            doc.add_paragraph(TEXT)
            doc.save(directory / 'resume.docx')
            self.assertIn('Jane Doe', self.extract(directory / 'resume.docx')['extractedText'])
            # A minimal valid PDF fixture with selectable text.
            stream = ('BT /F1 12 Tf 30 100 Td (' + TEXT.replace('\n', ' ') + ') Tj ET').encode()
            objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
                b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
                b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
                b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream']
            pdf = b'%PDF-1.4\n'
            offsets = []
            for index, obj in enumerate(objects, 1):
                offsets.append(len(pdf))
                pdf += f'{index} 0 obj\n'.encode() + obj + b'\nendobj\n'
            xref = len(pdf)
            pdf += b'xref\n0 6\n0000000000 65535 f \n'
            pdf += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets)
            pdf += f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
            (directory / 'resume.pdf').write_bytes(pdf)
            self.assertIn('Jane Doe', self.extract(directory / 'resume.pdf')['extractedText'])

    def test_unreadable_spoofed_and_oversized_documents(self):
        from PyPDF2 import PdfWriter
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            for name, data in [('empty.txt', b''), ('binary.txt', b'\x00' * 100), ('fake.pdf', TEXT.encode()), ('fake.docx', TEXT.encode()), ('long.txt', b'a' * 50001)]:
                file = directory / name
                file.write_bytes(data)
                self.assertIn('error', self.extract(file), name)
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            file = directory / 'scan.pdf'
            with file.open('wb') as output:
                writer.write(output)
            self.assertIn('error', self.extract(file))

if __name__ == '__main__':
    unittest.main()
