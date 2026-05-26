using System;
using System.Threading;
using FUTEK_USB_DLL;

namespace HelloWorld {

    class Hello {

        /* compile command: csc *.cs /r:FUTEK_USB_DLL.dll */

        public static FUTEK_USB_DLL.USB_DLL oFutekUSBDLL;

        public static string SerialNumber;
        public static System.IntPtr DeviceHandle;
        public static string Temp;

        public static Boolean OpenedConnection;
        private static char delimiter;

        public static int sleepFor = 40;

        public static void ReadThread() {

            while(OpenedConnection) {
                oFutekUSBDLL.Get_Display_Page(DeviceHandle);
                Temp = oFutekUSBDLL.LCDLine2;
                string[] words = Temp.Split(delimiter);

                Console.Write(Temp + "\n");

                Thread.Sleep(sleepFor);
            }

        }

        public static void readDataFromDevice() {
            oFutekUSBDLL = new FUTEK_USB_DLL.USB_DLL();

            DeviceHandle = new IntPtr(0);
            delimiter = ' ';
            OpenedConnection = false;

            ThreadStart childref = new ThreadStart(ReadThread);

            Thread childThread = new Thread(childref);

            String s;

            int ctr = 0;
            do {
                ctr++;
                s = Console.ReadLine();
                if(s.Equals("start")) {
                    if (OpenedConnection == false) { }
                    else { return; }

                    oFutekUSBDLL.Open_Device_Connection(SerialNumber);

                    if (oFutekUSBDLL.DeviceStatus == 0) { }
                    else {
                        Console.Write("Error");
                        return;
                    }
                    DeviceHandle = oFutekUSBDLL.DeviceHandle;
                    OpenedConnection = true;
                    childThread.Start();
                }

                if(s.Equals("stop")) {
                    if (OpenedConnection == true) { }
                    else { return; }

                    oFutekUSBDLL.Close_Device_Connection(DeviceHandle);

                    if (oFutekUSBDLL.DeviceStatus == 0) { }
                    else {
                        Console.Write("Error");
                        return;
                    }

                    OpenedConnection = false;
                    break;
                }
            } while (s != null);
        }

        public static void ReadThreadFake() {

            Random r = new Random();

            while(OpenedConnection) {

                Console.Write(r.Next(0, 2) + " lbs\n");

                Thread.Sleep(sleepFor);
            }
        }

        public static void testFunction() {
            ThreadStart childref = new ThreadStart(ReadThreadFake);
            Thread childThread = new Thread(childref);

            String s;

            int ctr = 0;
            do {
                ctr++;
                s = Console.ReadLine();
                if(s.Equals("start")) {
                    OpenedConnection = true;
                    childThread.Start();
                }
                if(s.Equals("stop")) {
                    OpenedConnection = false;
                    break;
                }
            } while (s != null);
        }


        static void Main(string[] args) {
            SerialNumber = args[0];
            //readDataFromDevice();
            testFunction();
        }

    }
}
