import win32com.client
import sys

def count_pages(doc_path):
    word = win32com.client.Dispatch("Word.Application")
    doc = word.Documents.Open(doc_path)
    pages = doc.ComputeStatistics(2)  # 2 is for the number of pages
    doc.Close(False)
    word.Quit()
    return pages

if __name__ == "__main__":
    doc_path = sys.argv[1]
    print(count_pages(doc_path))
